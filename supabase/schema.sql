-- ============================================================================
-- Vision Referral Tracker — Database Schema
-- Platform: Supabase (PostgreSQL)
-- Owner: Abdelwahab Fekri (admin)
--
-- PRIVACY BOUNDARY (do not violate):
--   The only patient identifier stored is the MRN (referrals.mrn). Beyond
--   that the database holds a referral code (VOR-#######) and operational
--   status — no names, DOBs, phone numbers, addresses, or clinical notes.
--   Because MRN is PHI, every read path must go through RLS (see section 9).
--   "Provider" and "specialist" names below are NOT patient data.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

-- Track 1 — Patient / Appointment lifecycle
create type appointment_status as enum (
  'referral_created',
  'patient_contacted',
  'awaiting_booking',           -- reached patient; they'll book and call back
  'appointment_scheduled',
  'appointment_confirmed',
  'appointment_completed',
  'appointment_rescheduled',   -- branch, returns to flow (cap 3)
  'patient_not_replying',      -- parking, after 5 attempts
  'patient_declined',          -- terminal
  'cancelled'                  -- terminal
);

-- Track 2 — Documents / Provider lifecycle
create type document_status as enum (
  'awaiting_appointment',      -- dormant until Track 1 completes
  'records_request_due',       -- visit done; specialist office not yet asked for records
  'documents_requested',
  'documents_received',
  'documents_uploaded',
  'documents_unavailable',     -- terminal (incomplete), after 3 attempts
  'closed'                     -- terminal (success)
);

-- Application roles
create type user_role as enum ('admin', 'viewer');

-- Provider visibility scope for viewer accounts
--   'all'  -> sees every referral (shared login, Dr. Solomon)
--   'own'  -> sees only referrals where they are the referring provider
create type provider_scope as enum ('all', 'own');

-- ============================================================================
-- 2. REFERRING PROVIDERS (lookup)
--   Internal department providers who initiate referrals.
--   Names stored "Last,First" per department convention.
-- ============================================================================
create table referring_providers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,     -- e.g. 'Klein,Solomon'
  report_email text                      -- work email for the weekly report (copied by hand, never sent by the app)
    constraint provider_report_email_format
    check (report_email is null or report_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 3. APP USERS
--   Mirrors Supabase auth.users (1:1 by id). Carries role + scope.
--   A viewer with scope='own' is limited to their linked provider_id.
-- ============================================================================
create table app_users (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         user_role not null default 'viewer',
  scope        provider_scope not null default 'all',
  provider_id  uuid references referring_providers(id),  -- required only when scope='own'
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint scope_requires_provider
    check (scope = 'all' or (scope = 'own' and provider_id is not null))
);

-- ============================================================================
-- 4. REFERRALS  (one referral = one specialist = one track pair)
-- ============================================================================
create table referrals (
  id                    uuid primary key default gen_random_uuid(),

  -- Tracking identifier shown in the UI.
  code                  text not null unique,            -- 'VOR-4820193'

  -- Patient MRN (PHI). Text, never numeric, so leading zeros survive.
  -- Not unique: one patient can have several referrals.
  mrn                   text not null
    constraint mrn_format check (mrn = btrim(mrn) and char_length(mrn) between 1 and 32),

  -- Directory info (NON-PHI)
  referring_provider_id uuid not null references referring_providers(id),
  specialist_name       text,                            -- external specialist referred to
  specialist_phone      text,
  specialist_fax        text,
  specialty             text,                            -- e.g. 'Retina', 'Glaucoma'

  -- Two-track state
  appointment_state     appointment_status not null default 'referral_created',
  document_state        document_status    not null default 'awaiting_appointment',

  -- Scheduling
  appointment_slot      timestamptz,                     -- the booked slot, when known

  -- Follow-up counters (drive the To-Do engine caps)
  contact_attempts      int not null default 0,          -- cap 5  -> patient_not_replying
  reschedule_count      int not null default 0,          -- cap 3  -> owner review
  document_attempts     int not null default 0,          -- cap 3  -> documents_unavailable

  -- Clock: when the next To-Do action is due for this referral
  next_action_due       timestamptz,
  last_action_at        timestamptz,

  -- Lifecycle timestamps
  referral_date         timestamptz not null default now(),
  completed_at          timestamptz,                     -- appointment_completed time
  closed_at             timestamptz,                     -- closed / terminal time

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_referrals_code            on referrals (code);
create index idx_referrals_mrn             on referrals (mrn);
create index idx_referrals_provider        on referrals (referring_provider_id);
create index idx_referrals_appt_state      on referrals (appointment_state);
create index idx_referrals_doc_state       on referrals (document_state);
create index idx_referrals_next_due        on referrals (next_action_due);

-- ============================================================================
-- 5. STATUS TRANSITION LOG  (full history — never updated, only inserted)
--   Every status change on either track writes one immutable row here.
--   This is the source for all aging / duration / throughput analytics.
-- ============================================================================
create table status_history (
  id             bigint generated always as identity primary key,
  referral_id    uuid not null references referrals(id) on delete cascade,
  -- 'meta' = not a transition on either track (follow-up set, details edited, existing-referral baseline)
  track          text not null
    constraint status_history_track_check check (track in ('appointment','document','meta')),
  from_state     text,                         -- null on first entry
  to_state       text not null,
  note_code      text,                         -- structured reason code, NON-PHI (e.g. 'no_answer')
  note_text      text,                         -- optional admin free-text note (never PHI — enforced by policy, not schema)
  changed_by     uuid references app_users(id),
  changed_at     timestamptz not null default now()
);

create index idx_history_referral on status_history (referral_id, changed_at);
create index idx_history_changed  on status_history (changed_at);

-- ============================================================================
-- 6. CODE GENERATION  — VOR- + 7 random digits, unique, regenerate on collision
-- ============================================================================
create or replace function generate_referral_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  exists_already boolean;
begin
  loop
    -- 7 digits, zero-padded, range 0000000..9999999
    new_code := 'VOR-' || lpad((floor(random() * 10000000))::int::text, 7, '0');
    select exists(select 1 from referrals where code = new_code) into exists_already;
    exit when not exists_already;
  end loop;
  return new_code;
end;
$$;

-- Auto-assign code on insert if not supplied
create or replace function set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := generate_referral_code();
  end if;
  return new;
end;
$$;

create trigger trg_set_referral_code
  before insert on referrals
  for each row execute function set_referral_code();

-- ============================================================================
-- 7. updated_at maintenance
-- ============================================================================
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_referrals_touch
  before update on referrals
  for each row execute function touch_updated_at();

-- ============================================================================
-- 8. ANALYTICS VIEWS  (v_referral_enriched exposes mrn — RLS-guarded)
--   security_invoker = on: views run with the caller's privileges so the RLS
--   policies on referrals/status_history apply. Without it a view runs as its
--   owner (postgres), bypassing RLS — scope='own' viewers and even the anon
--   key could read every referral through the view. Requires Postgres 15+.
-- ============================================================================

-- Convenience: is a referral in a terminal state?
create or replace view v_referral_enriched
  with (security_invoker = on) as
select
  r.*,
  rp.name as referring_provider_name,
  (r.appointment_state in ('patient_declined','cancelled')
     or r.document_state in ('documents_unavailable','closed'))          as is_terminal,
  (r.document_state = 'closed')                                          as is_closed_success,
  case
    when r.document_state = 'closed'      then r.closed_at
    when r.appointment_state = 'patient_declined' then r.closed_at
    when r.appointment_state = 'cancelled'        then r.closed_at
    else null
  end as terminal_at,
  -- aging in days for anything not yet closed/terminal
  case
    when r.document_state = 'closed'
      or r.appointment_state in ('patient_declined','cancelled')
    then null
    else extract(epoch from (now() - r.referral_date)) / 86400.0
  end as aging_days
from referrals r
join referring_providers rp on rp.id = r.referring_provider_id;

-- Dashboard summary counts
create or replace view v_dashboard_summary
  with (security_invoker = on) as
select
  count(*) filter (
    where document_state <> 'closed'
      and appointment_state not in ('patient_declined','cancelled')
  ) as active_referrals,

  count(*) filter (where document_state = 'closed')            as completed_referrals,

  count(*) filter (
    where appointment_state = 'patient_not_replying'
  ) as awaiting_patient_response,

  count(*) filter (
    where appointment_state in ('referral_created','patient_contacted','awaiting_booking','appointment_rescheduled')
  ) as awaiting_scheduling,

  count(*) filter (
    where document_state in ('documents_requested','documents_received')
  ) as outstanding_documents,

  count(*) filter (
    where next_action_due is not null and next_action_due <= now()
      and document_state <> 'closed'
      and appointment_state not in ('patient_declined','cancelled')
  ) as due_now,

  avg( extract(epoch from (closed_at - referral_date)) / 86400.0 )
    filter (where document_state = 'closed')                  as avg_completion_days
from referrals;

-- Per-provider volume + completion rate
create or replace view v_provider_stats
  with (security_invoker = on) as
select
  rp.id   as provider_id,
  rp.name as provider_name,
  count(r.id)                                                      as total_referrals,
  count(r.id) filter (where r.document_state = 'closed')          as completed,
  count(r.id) filter (
    where r.document_state <> 'closed'
      and r.appointment_state not in ('patient_declined','cancelled')
  )                                                                as active,
  round(
    100.0 * count(r.id) filter (where r.document_state = 'closed')
    / nullif(count(r.id), 0)
  , 1)                                                             as completion_rate_pct
from referring_providers rp
left join referrals r on r.referring_provider_id = rp.id
group by rp.id, rp.name
order by total_referrals desc;

-- Signed-out clients never read the views (defense in depth on top of RLS).
revoke all on v_referral_enriched, v_dashboard_summary, v_provider_stats from anon;

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================
alter table referrals            enable row level security;
alter table status_history       enable row level security;
alter table referring_providers  enable row level security;
alter table app_users            enable row level security;

-- Helper: current user's app_users row
-- security definer + fixed search_path: these helpers query app_users, which
-- itself has RLS policies that call is_admin() — without bypassing RLS here,
-- evaluating the policy re-triggers the policy and Postgres blows its stack
-- ("stack depth limit exceeded") on effectively every read/write.
create or replace function current_app_user()
returns app_users
language sql stable security definer set search_path = public
as $$
  select * from app_users where id = auth.uid();
$$;

-- Helper: is current user an admin?
create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from app_users where id = auth.uid()), false);
$$;

-- Helper: can the current (viewer) user see referrals for this provider?
-- Also security definer — any function queried from inside a policy on
-- referrals must bypass app_users' own RLS, or it recurses the same way.
create or replace function can_view_provider(p_provider_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from app_users u
    where u.id = auth.uid()
      and u.role = 'viewer'
      and u.active
      and (
        u.scope = 'all'
        or (u.scope = 'own' and u.provider_id = p_provider_id)
      )
  );
$$;

-- ---- referrals ----
-- Admin: full read/write.
create policy referrals_admin_all
  on referrals for all
  using (is_admin())
  with check (is_admin());

-- Viewer: read-only. scope='all' sees everything; scope='own' sees only theirs.
create policy referrals_viewer_select
  on referrals for select
  using (can_view_provider(referring_provider_id));

-- ---- status_history ----
create policy history_admin_all
  on status_history for all
  using (is_admin())
  with check (is_admin());

create policy history_viewer_select
  on status_history for select
  using (
    exists (
      select 1
      from referrals r
      join app_users u on u.id = auth.uid()
      where r.id = status_history.referral_id
        and u.role = 'viewer'
        and u.active
        and (
          u.scope = 'all'
          or (u.scope = 'own' and u.provider_id = r.referring_provider_id)
        )
    )
  );

-- ---- referring_providers ----
-- Everyone authenticated can read the provider list (needed for filters/labels).
create policy providers_read_all
  on referring_providers for select
  using (auth.uid() is not null);

create policy providers_admin_write
  on referring_providers for all
  using (is_admin())
  with check (is_admin());

-- ---- app_users ----
-- A user can read their own row; admin can read/write all.
create policy appusers_self_read
  on app_users for select
  using (id = auth.uid() or is_admin());

create policy appusers_admin_write
  on app_users for all
  using (is_admin())
  with check (is_admin());

-- ============================================================================
-- 10. WORKFLOW WRITES — state change + history in one transaction
-- ============================================================================
-- Apply a computed change to one referral plus its history rows, atomically.
--   p_expected_updated_at: the updated_at the caller's page loaded. If the row
--   changed since, raise VT409 and write nothing.
--   p_fields: column -> new value (unlisted columns keep their current value).
--   p_events: array of {track, from_state, to_state, note_code, note_text, changed_at?}.
-- security invoker: RLS still applies; admin is also checked explicitly.
create or replace function apply_referral_change(
  p_referral_id uuid,
  p_expected_updated_at timestamptz,
  p_fields jsonb,
  p_events jsonb
) returns referrals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row referrals;
  v_new referrals;
  v_event jsonb;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_row from referrals where id = p_referral_id for update;
  if not found then
    raise exception 'referral not found' using errcode = 'P0002';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'referral changed since it was loaded' using errcode = 'VT409';
  end if;

  v_new := jsonb_populate_record(v_row, coalesce(p_fields, '{}'::jsonb) - array['id','code','created_at','updated_at']);

  update referrals set
    mrn                   = v_new.mrn,
    referring_provider_id = v_new.referring_provider_id,
    specialist_name       = v_new.specialist_name,
    specialist_phone      = v_new.specialist_phone,
    specialist_fax        = v_new.specialist_fax,
    specialty             = v_new.specialty,
    appointment_state     = v_new.appointment_state,
    document_state        = v_new.document_state,
    appointment_slot      = v_new.appointment_slot,
    contact_attempts      = v_new.contact_attempts,
    reschedule_count      = v_new.reschedule_count,
    document_attempts     = v_new.document_attempts,
    next_action_due       = v_new.next_action_due,
    last_action_at        = v_new.last_action_at,
    referral_date         = v_new.referral_date,
    completed_at          = v_new.completed_at,
    closed_at             = v_new.closed_at
  where id = p_referral_id
  returning * into v_new;

  for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into status_history (referral_id, track, from_state, to_state, note_code, note_text, changed_by, changed_at)
    values (
      p_referral_id,
      v_event->>'track',
      v_event->>'from_state',
      v_event->>'to_state',
      v_event->>'note_code',
      nullif(btrim(v_event->>'note_text'), ''),
      auth.uid(),
      coalesce((v_event->>'changed_at')::timestamptz, now())
    );
  end loop;

  return v_new;
end;
$$;

-- Insert a referral plus its first history rows, atomically.
create or replace function create_referral(
  p_fields jsonb,
  p_events jsonb
) returns referrals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_in  referrals;
  v_new referrals;
  v_event jsonb;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  v_in := jsonb_populate_record(null::referrals, coalesce(p_fields, '{}'::jsonb) - array['id','code','created_at','updated_at']);

  insert into referrals (
    mrn, referring_provider_id, specialist_name, specialist_phone, specialist_fax, specialty,
    appointment_state, document_state, appointment_slot,
    contact_attempts, reschedule_count, document_attempts,
    next_action_due, last_action_at, referral_date, completed_at, closed_at
  ) values (
    v_in.mrn, v_in.referring_provider_id, v_in.specialist_name, v_in.specialist_phone, v_in.specialist_fax, v_in.specialty,
    coalesce(v_in.appointment_state, 'referral_created'),
    coalesce(v_in.document_state, 'awaiting_appointment'),
    v_in.appointment_slot,
    coalesce(v_in.contact_attempts, 0), coalesce(v_in.reschedule_count, 0), coalesce(v_in.document_attempts, 0),
    v_in.next_action_due, v_in.last_action_at, coalesce(v_in.referral_date, now()), v_in.completed_at, v_in.closed_at
  )
  returning * into v_new;

  for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into status_history (referral_id, track, from_state, to_state, note_code, note_text, changed_by, changed_at)
    values (
      v_new.id,
      v_event->>'track',
      v_event->>'from_state',
      v_event->>'to_state',
      v_event->>'note_code',
      nullif(btrim(v_event->>'note_text'), ''),
      auth.uid(),
      coalesce((v_event->>'changed_at')::timestamptz, now())
    );
  end loop;

  return v_new;
end;
$$;

revoke all on function apply_referral_change(uuid, timestamptz, jsonb, jsonb) from public, anon;
revoke all on function create_referral(jsonb, jsonb) from public, anon;
grant execute on function apply_referral_change(uuid, timestamptz, jsonb, jsonb) to authenticated;
grant execute on function create_referral(jsonb, jsonb) to authenticated;

-- ============================================================================
-- 11. SEED — referring providers (Last,First)
-- ============================================================================
insert into referring_providers (name, report_email) values
  ('Akilov,Sarah',     'sakilov@aizerhealth.org'),
  ('Berger,Zvi',       'zberger@aizerhealth.org'),
  ('Goldberg,Joel B.', 'jgoldberg@echckj.org'),
  ('Herbik,Max',       'mherbik@aizerhealth.org'),
  ('Klein,Solomon',    'sklein@aizerhealth.org'),
  ('Sheth,Shaily',     'ssheth@aizerhealth.org')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- NOTE on app_users seeding:
--   App user rows must reference auth.users(id), so they are created AFTER
--   you invite/create the auth accounts in Supabase. See README for the
--   exact steps. Planned accounts:
--     1. Abdelwahab Fekri   role=admin   scope=all
--     2. Providers (shared) role=viewer  scope=all
--     3. Klein,Solomon      role=viewer  scope=all   (sees everything)
-- ----------------------------------------------------------------------------
