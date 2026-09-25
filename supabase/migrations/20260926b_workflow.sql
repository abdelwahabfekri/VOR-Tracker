-- ============================================================================
-- Migration: atomic workflow writes, admin history events, provider emails
--
-- Run AFTER 20260926a_records_request_due.sql (separately). Idempotent.
--
-- 1. status_history.track accepts 'meta' for events that are not a status
--    transition on either track (follow-up date set, details edited,
--    existing-referral baseline).
-- 2. referring_providers.report_email — optional, for the weekly report.
-- 3. apply_referral_change / create_referral — every state change and its
--    history rows are written in ONE transaction, with an optimistic-lock
--    check so a stale page cannot overwrite a newer change.
-- 4. Data: completed visits still awaiting records move to records_request_due.
-- ============================================================================

-- 1. ---------------------------------------------------------------------------
alter table status_history drop constraint if exists status_history_track_check;
alter table status_history add constraint status_history_track_check
  check (track in ('appointment','document','meta'));

-- 2. ---------------------------------------------------------------------------
alter table referring_providers add column if not exists report_email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_report_email_format') then
    alter table referring_providers add constraint provider_report_email_format
      check (report_email is null or report_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end $$;

-- 3. ---------------------------------------------------------------------------
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

-- 4. ---------------------------------------------------------------------------
-- Visit completed but records never requested -> records_request_due, due now.
-- Referrals already at documents_requested stay: records are assumed requested.
-- The marker row documents the move; the weekly report does not count it as activity.
with moved as (
  update referrals
     set document_state = 'records_request_due',
         next_action_due = now()
   where appointment_state = 'appointment_completed'
     and document_state = 'awaiting_appointment'
  returning id
)
insert into status_history (referral_id, track, from_state, to_state, note_code, changed_at)
select id, 'document', 'awaiting_appointment', 'records_request_due', 'migration_marker', now()
from moved;

-- ----------------------------------------------------------------------------
-- Verification:
--   select proname from pg_proc where proname in ('apply_referral_change','create_referral'); -- 2 rows
--   select column_name from information_schema.columns
--    where table_name = 'referring_providers' and column_name = 'report_email';              -- 1 row
-- ----------------------------------------------------------------------------
