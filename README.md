# Assurance Regent v4.6.0 — Supabase Connected Core

This build converts the normal Assurance Regent application to a static GitHub/Netlify site backed directly by Supabase. It does **not** require the former Node/Express API or Netlify Functions for normal account use.

## What is connected to Supabase
- Developer, Administrator and Employee account credentials and signed-in sessions
- Companies and user profiles
- Employees and company structure
- Projects, payroll and calendar records
- Work Activity Hub / MTS records and internal messages
- Recovery time entries and source checks
- Recruiting vacancies, candidates and onboarding
- Control Center settings and documents

The site uses only the browser-safe Supabase publishable key. No Supabase secret/service-role key is included in browser code.

## One-time Supabase Dashboard setup — no terminal required
1. Open your Supabase project.
2. Open **SQL Editor** → **New query**.
3. Copy the entire contents of `supabase/ASSURANCE_REGENT_DIRECT_BROWSER_MODE.sql`.
4. Paste it into the SQL Editor and click **Run**.
5. The final query creates a health-check RPC used by the website to detect an incomplete setup.

## GitHub → Netlify
Upload/commit the contents of this package to the GitHub branch connected to Netlify. `netlify.toml` publishes `public/` directly. There is no application-server build step and no `netlify/functions` dependency.

## Developer login
- User type: **Developers - Only**
- Username: **Dvp**
- Password: **Abcd@1234**

## v4.6.0 reliability fixes
- Supabase login survives normal page refreshes during the active browser session. Only the temporary authentication token/user ID is kept in `sessionStorage`; operational data remains in Supabase.
- All normal Assurance Regent persistence continues through Supabase RPC calls.
- Added a Supabase health check with an actionable setup message.
- Company IDs are retained on employees, projects, payroll, calendar, time, recruiting and onboarding records so Developer-created records stay attached to the selected company.
- Work Activity Hub sessions, messages and supporting documents retain company context.
- Public external HTTP requests such as reverse geocoding are allowed, while the retired internal `/api/...` server remains blocked.
- Recovery Agent / server-side AI remains hidden because it requires a secure server-side secret integration.

## Important data model note
This release intentionally prioritizes a reliable direct-Supabase migration of the existing Assurance Regent interface. Operational records are persisted in a protected Supabase JSON state row accessed through `SECURITY DEFINER` RPC functions. A later hardening/scale phase can normalize each module into its own PostgreSQL table and move file bodies to Supabase Storage, matching FINDAT's larger Auth/RLS/Storage architecture more closely.
