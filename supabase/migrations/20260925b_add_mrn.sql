-- ============================================================================
-- Migration: add MRN to referrals
--
-- Run AFTER 20260925_secure_views.sql — MRN is PHI and must not be exposed
-- through views that bypass RLS.
--
-- Stage 1 (this file): column is nullable so existing referrals stay valid.
-- The app requires MRN on every new referral.
-- Stage 2 (later, once every existing referral has an MRN):
--   alter table referrals alter column mrn set not null;
--
-- Idempotent. Run once in the Supabase SQL Editor.
-- ============================================================================

alter table referrals add column if not exists mrn text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mrn_format') then
    alter table referrals add constraint mrn_format
      check (mrn = btrim(mrn) and char_length(mrn) between 1 and 32);
  end if;
end $$;

create index if not exists idx_referrals_mrn on referrals (mrn);

-- v_referral_enriched selects r.* — a view's column list is frozen at creation,
-- so recreate it to pick up mrn. Same definition as schema.sql.
drop view if exists v_referral_enriched;
create view v_referral_enriched
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
  case
    when r.document_state = 'closed'
      or r.appointment_state in ('patient_declined','cancelled')
    then null
    else extract(epoch from (now() - r.referral_date)) / 86400.0
  end as aging_days
from referrals r
join referring_providers rp on rp.id = r.referring_provider_id;

revoke all on v_referral_enriched from anon;
grant select on v_referral_enriched to authenticated;

-- ----------------------------------------------------------------------------
-- Verification:
--   select column_name from information_schema.columns
--   where table_name = 'v_referral_enriched' and column_name = 'mrn';   -- 1 row
--   select reloptions from pg_class where relname = 'v_referral_enriched'; -- {security_invoker=on}
--
-- Referrals still missing an MRN (backfill these before stage 2):
--   select code from referrals where mrn is null order by referral_date;
-- ----------------------------------------------------------------------------
