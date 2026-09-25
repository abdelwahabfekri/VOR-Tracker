# Vision Referral Tracker

Operational tracking for the Aizer **Department of Vision** referral process.
Built with Next.js (App Router) + Supabase, deploys on Vercel.

> **Privacy boundary — do not cross.** The only patient identifier this
> application stores is the **MRN**, alongside a tracking code (`VOR-#######`)
> and operational status. It holds **no** names, dates of birth, phone numbers,
> addresses, or clinical notes. Because MRN is PHI, every read goes through
> row-level security. "Provider" and "specialist" fields are business
> contacts, not patient data.

---

## What's inside

- **To-Do** (admin) — calls and record-chases due now, grouped by urgency, one-tap outcome logging.
- **Tracking** — every referral as a row with dual-track status (appointment + documents); the documents track stays greyed as *Awaiting appointment* until the visit is completed. Click a row for the full journey.
- **Referral detail** — a shipping-style progress tracker, specialist reference (phone/fax), attempt counters, and a timestamped "tracking history" of every status change. Notes and the call log are visible to admins and to doctors allowed to see the referral. Admins also get **Edit details**, **Set follow-up date**, and **Correct status** (fixes a wrong entry with a required reason; history is appended, never rewritten).
- **Dashboard** — stat cards then charts (provider volume, status mix, aging).
- **New referral** (admin) — records the patient MRN and generates the `VOR-` tracking code.
- **Add existing referral** (admin) — enters a referral already in progress at its real current stage, without inventing earlier history.
- **Weekly Reports** (admin) — one report per internal provider: active referrals plus anything that changed or closed in the period, sorted by open date, with *Weekly activity* and *Follow-up* tags. Copies as a formatted table for Outlook (plain-text fallback). The app never sends email.
- **Stale tags** — `NO UPDATE 7+ DAYS` / `14+ DAYS` on referrals with no real action for that long (separate from *Overdue*).
- **Roles** — `admin` (you: full control) and `viewer` (providers: read-only).

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Note the project's **URL** and **anon key** (Project Settings → API).
2. Open the **SQL Editor** and run, in order:
   - `supabase/schema.sql`  (tables, enums, code generator, analytics views, row-level security, and the six seeded providers)
   - `supabase/seed.sql`    (optional — 6 test referrals; see "Removing test data" below)
3. **Existing projects** (schema already installed): run each file in `supabase/migrations/` that hasn't been applied yet, oldest first, **each file as its own run** (one SQL Editor execution per file — `20260926a` adds an enum value that `20260926b` uses, and Postgres can't use a new enum value in the same transaction). Fresh installs don't need them — `schema.sql` already includes them.

## 2. Create the user accounts

App users must exist as Supabase auth users first, then get an `app_users` row that carries their role.

**In Supabase → Authentication → Users → Add user**, create the accounts (set a password for each):

| Purpose            | Example email                | Role   |
|--------------------|------------------------------|--------|
| Abdelwahab Fekri   | abdelwahab@aizerhealth.com   | admin  |
| Providers (shared) | providers@aizerhealth.com    | viewer |
| Dr. Solomon Klein  | solomon.klein@aizerhealth.com| viewer |

Then, in the **SQL Editor**, insert the matching `app_users` rows. Replace each
`AUTH_USER_ID` with the UUID shown on the user in the Authentication table:

```sql
-- Admin
insert into app_users (id, full_name, role, scope)
values ('AUTH_USER_ID_ADMIN', 'Abdelwahab Fekri', 'admin', 'all');

-- Shared provider viewer (sees everything)
insert into app_users (id, full_name, role, scope)
values ('AUTH_USER_ID_PROVIDERS', 'Vision Providers', 'viewer', 'all');

-- Dr. Solomon Klein (sees everything)
insert into app_users (id, full_name, role, scope)
values ('AUTH_USER_ID_SOLOMON', 'Klein,Solomon', 'viewer', 'all');
```

> To later give a provider a login scoped to **only their own** referrals, insert
> them with `scope='own'` and `provider_id` set to their row in
> `referring_providers`. The schema and security policies already support this.

## 3. Run locally (optional)

```bash
cp .env.example .env.local     # fill in your Supabase URL + anon key
npm install
npm run dev                    # http://localhost:3000
```

## 4. Deploy to Vercel

1. Push this folder to a **GitHub** repo.
2. In [Vercel](https://vercel.com) → **New Project** → import the repo.
3. Add two Environment Variables (from Supabase → Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Vercel auto-detects Next.js — no extra config needed.

---

## Removing the test data

The 6 seed referrals all use the `VOR-999xxxx` range. To wipe them:

```sql
delete from referrals where code like 'VOR-999%';
```

Their history rows cascade-delete automatically.

---

## How the follow-up clock works

The status engine (`src/lib/statusEngine.ts`) encodes the locked SOP rules:

| Stage | Timing | Cap |
|-------|--------|-----|
| First patient contact | due 24h after creation (attempt 1) | — |
| Scheduling follow-up | every 3 days | 5 attempts → *Unable to reach patient* |
| Pre-appointment confirmation call | 24h before slot | — |
| Post-appointment check | 24h after slot | — |
| Reschedule | on request | 3 → flagged for review |
| Visit done → *Records request needed* | due immediately: contact the specialist office | — |
| *Records requested* (separate action, once the office was actually asked) | chase every 5 days | 3 attempts → *Records unavailable* |

A completed visit does **not** mean records were requested. If the office can't
be reached, the referral stays at *Records request needed* and the admin sets
the next attempt with **Set follow-up date**.

A no-show silently returns the referral to the scheduling cycle (no distinct
status), per the agreed design.

Every action is validated against the referral's current state on the server,
then the row update and all of its `status_history` rows are written in one
transaction (`apply_referral_change`). If the referral changed after the page
was loaded, the action is refused with a "refresh and try again" message.

---

## Data model (quick reference)

- `referring_providers` — the six department providers (lookup).
- `referrals` — one row per referral (one specialist, one track pair): code,
  both track states, attempt counters, clock fields, lifecycle timestamps.
- `status_history` — append-only log of every transition (the "scan history").
  `track = 'meta'` rows record admin events that are not a transition
  (follow-up date set, details edited, existing-referral baseline).
- `referring_providers.report_email` — optional recipient for the weekly report.
- RPCs: `apply_referral_change`, `create_referral` — atomic state + history writes.
- `app_users` — role + visibility scope, linked 1:1 to Supabase auth.
- Views: `v_referral_enriched`, `v_dashboard_summary`, `v_provider_stats`.

---

## Security note

This project pins `next@14.2.x`. Next.js has since published further security
patches in the 15.x line. When you have capacity, plan an upgrade to the latest
Next.js 15 (note the async `cookies()`/`headers()` API changes) and run
`npm audit` as part of that work. The app stores patient MRNs (PHI), so treat this
upgrade as a priority.
