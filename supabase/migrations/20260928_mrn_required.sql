-- ============================================================================
-- Migration: delete all existing referrals, then make MRN required
--
-- !! DESTRUCTIVE — cannot be undone !!
-- Every referral created before MRN existed was test data, so they are all
-- deleted instead of backfilled. Their status_history rows go with them
-- (ON DELETE CASCADE). Providers and user accounts are not touched.
--
-- Run AFTER 20260926b_workflow.sql, on its own. Safe to re-run.
-- ============================================================================

delete from referrals;

alter table referrals alter column mrn set not null;

-- ----------------------------------------------------------------------------
-- Verification:
--   select count(*) from referrals;       -- 0
--   select count(*) from status_history;  -- 0
--   select is_nullable from information_schema.columns
--    where table_name = 'referrals' and column_name = 'mrn';   -- NO
-- ----------------------------------------------------------------------------
