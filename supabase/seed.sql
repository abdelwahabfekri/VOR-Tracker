-- ============================================================================
-- SEED — 5 test referrals across varied states.
-- All codes use the VOR-999xxxx range so they are easy to spot and delete.
--
-- TO REMOVE ALL TEST DATA LATER, run:
--   delete from referrals where code like 'VOR-999%';
-- (status_history rows cascade-delete automatically.)
--
-- Run this AFTER schema.sql. Safe to run once.
-- ============================================================================

-- Helper: resolve provider ids by name
with p as (
  select
    (select id from referring_providers where name='Akilov,Sarah')      as akilov,
    (select id from referring_providers where name='Berger,Zvi')        as berger,
    (select id from referring_providers where name='Goldberg,Joel B.')  as goldberg,
    (select id from referring_providers where name='Herbik,Max')        as herbik,
    (select id from referring_providers where name='Klein,Solomon')     as klein
)
insert into referrals
  (code, referring_provider_id, specialist_name, specialty, specialist_phone, specialist_fax,
   appointment_state, document_state, appointment_slot,
   contact_attempts, reschedule_count, document_attempts,
   next_action_due, last_action_at, referral_date, completed_at, closed_at)
select * from (
  select
    'VOR-9990001'::text, (select akilov from p), 'Retina Associates'::text, 'Retina'::text, '212-555-0143'::text, '212-555-0144'::text,
    'referral_created'::appointment_status, 'awaiting_appointment'::document_status, null::timestamptz,
    0, 0, 0,
    now() - interval '6 hours', now() - interval '30 hours', now() - interval '30 hours', null::timestamptz, null::timestamptz
  union all
  select
    'VOR-9990002', (select berger from p), 'Glaucoma Center of NY', 'Glaucoma', '212-555-0170', null::text,
    'patient_contacted'::appointment_status, 'awaiting_appointment'::document_status, null::timestamptz,
    2, 0, 0,
    now() - interval '1 day', now() - interval '3 days', now() - interval '9 days', null::timestamptz, null::timestamptz
  union all
  select
    'VOR-9990003', (select goldberg from p), 'Cornea Specialists', 'Cornea', '646-555-0102', '646-555-0103',
    'appointment_scheduled'::appointment_status, 'awaiting_appointment'::document_status, now() + interval '2 days',
    1, 0, 0,
    now() + interval '1 day', now() - interval '2 days', now() - interval '7 days', null::timestamptz, null::timestamptz
  union all
  select
    'VOR-9990004', (select herbik from p), 'Oculoplastics Group', 'Oculoplastics', '917-555-0188', '917-555-0189',
    'appointment_completed'::appointment_status, 'documents_requested'::document_status, now() - interval '3 days',
    1, 0, 1,
    now() - interval '1 day', now() - interval '2 days', now() - interval '18 days', now() - interval '3 days', null::timestamptz
  union all
  select
    'VOR-9990005', (select klein from p), 'Neuro-Ophthalmology Assoc.', 'Neuro-ophth', '212-555-0210', '212-555-0211',
    'appointment_completed'::appointment_status, 'closed'::document_status, now() - interval '20 days',
    1, 1, 0,
    null::timestamptz, now() - interval '10 days', now() - interval '34 days', now() - interval '20 days', now() - interval '10 days'
) as rows
on conflict (code) do nothing;

-- Minimal history so the tracking timeline isn't empty for seed rows.
insert into status_history (referral_id, track, from_state, to_state, note_code, changed_at)
select r.id, 'appointment', null, 'referral_created', 'created', r.referral_date
from referrals r where r.code like 'VOR-999%'
on conflict do nothing;

insert into status_history (referral_id, track, from_state, to_state, note_code, changed_at)
select r.id, 'appointment', 'referral_created', 'appointment_completed', 'visit_done', r.completed_at
from referrals r where r.code like 'VOR-999%' and r.completed_at is not null;

insert into status_history (referral_id, track, from_state, to_state, note_code, changed_at)
select r.id, 'document', 'documents_uploaded', 'closed', 'closed', r.closed_at
from referrals r where r.code like 'VOR-999%' and r.document_state = 'closed' and r.closed_at is not null;
