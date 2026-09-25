-- ============================================================================
-- Migration: make analytics views respect RLS
--
-- Problem: the views were created without security_invoker, so they ran with
-- the owner's (postgres) privileges and bypassed RLS on referrals. A viewer
-- with scope='own' saw every provider's referrals, and the anon key could read
-- them through the REST API without signing in.
--
-- Run once in the Supabase SQL Editor. Idempotent. Requires Postgres 15+.
-- ============================================================================

alter view v_referral_enriched set (security_invoker = on);
alter view v_dashboard_summary set (security_invoker = on);
alter view v_provider_stats    set (security_invoker = on);

revoke all on v_referral_enriched, v_dashboard_summary, v_provider_stats from anon;

-- ----------------------------------------------------------------------------
-- Verification (run after the migration):
--
-- 1) Every view reports security_invoker=on:
--      select relname, reloptions from pg_class
--      where relname in ('v_referral_enriched','v_dashboard_summary','v_provider_stats');
--
-- 2) anon has no privileges on the views (expect zero rows):
--      select table_name, privilege_type from information_schema.role_table_grants
--      where grantee = 'anon'
--        and table_name in ('v_referral_enriched','v_dashboard_summary','v_provider_stats');
--
-- 3) In the app: sign in as a scope='own' viewer — only that provider's
--    referrals appear. Admin still sees everything.
-- ----------------------------------------------------------------------------
