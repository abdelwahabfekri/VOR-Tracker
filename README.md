# Vision Referral Tracker

Operational tracking for the Aizer **Department of Vision** referral process.
Built with Next.js (App Router) + Supabase, deploys on Vercel.

> **Privacy boundary — do not cross.** This application stores only an opaque
> tracking code (`VOR-#######`) and operational status. It holds **no**
> patient-identifiable information: no names, MRNs, dates of birth, phone
> numbers, addresses, or clinical notes. The code↔patient link lives **only**
> in the secured in-domain Excel sheet. "Provider" and "specialist" fields are
> business contacts, not patient data.

---

## What's inside

- **To-Do** (admin) — calls and record-chases due now, grouped by urgency, one-tap outcome logging.
- **Tracking** — every referral as a row with dual-track status (appointment + documents); the documents track stays greyed as *Awaiting appointment* until the visit is completed. Click a row for the full journey.
- **Referral detail** — a shipping-style progress tracker, specialist reference (phone/fax), attempt counters, and a timestamped "tracking history" of every status change.
- **Dashboard** — stat cards then charts (provider volume, status mix, aging).
- **New referral** (admin) — generates the `VOR-` code to copy into the Excel sheet.
- **Roles** — `admin` (you: full control) and `viewer` (providers: read-only).

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Note the project's **URL** and **anon key** (Project Settings → API).
2. Open the **SQL Editor** and run, in order:
   - `supabase/schema.sql`  (tables, enums, code generator, analytics views, row-level security, and the six seeded providers)
   - `supabase/seed.sql`    (optional — 5 test referrals; see "Removing test data" below)

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

The 5 seed referrals all use the `VOR-999xxxx` range. To wipe them:

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
| Records chase | every 5 days | 3 attempts → *Records unavailable* |

A no-show silently returns the referral to the scheduling cycle (no distinct
status), per the agreed design. Every status change writes an immutable row to
`status_history`, which powers both the tracking timeline and the analytics.

---

## Data model (quick reference)

- `referring_providers` — the six department providers (lookup).
- `referrals` — one row per referral (one specialist, one track pair): code,
  both track states, attempt counters, clock fields, lifecycle timestamps.
- `status_history` — append-only log of every transition (the "scan history").
- `app_users` — role + visibility scope, linked 1:1 to Supabase auth.
- Views: `v_referral_enriched`, `v_dashboard_summary`, `v_provider_stats`.

---

## Security note

This project pins `next@14.2.x`. Next.js has since published further security
patches in the 15.x line. When you have capacity, plan an upgrade to the latest
Next.js 15 (note the async `cookies()`/`headers()` API changes) and run
`npm audit` as part of that work. The app is auth-gated and stores no PHI, which
limits exposure in the meantime.
