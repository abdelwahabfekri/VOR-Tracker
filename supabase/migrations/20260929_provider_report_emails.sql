-- ============================================================================
-- Weekly-report recipient emails for the internal providers.
-- Run once in the Supabase SQL Editor (after 20260926b_workflow.sql, which
-- adds report_email). Safe to re-run. Matches on the stored "Last,First"
-- name; a provider whose name doesn't match is simply not updated — check
-- the row count (6 expected).
-- ============================================================================

update referring_providers as p
set report_email = v.email
from (values
  ('Sheth,Shaily',     'ssheth@aizerhealth.org'),
  ('Klein,Solomon',    'sklein@aizerhealth.org'),
  ('Herbik,Max',       'mherbik@aizerhealth.org'),
  ('Berger,Zvi',       'zberger@aizerhealth.org'),
  ('Akilov,Sarah',     'sakilov@aizerhealth.org'),
  ('Goldberg,Joel B.', 'jgoldberg@echckj.org')
) as v(name, email)
where p.name = v.name;
