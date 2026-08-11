# Assurance Regent — Supabase-Only Edge Edition

Assurance Regent now uses Supabase as its hosted backend. The web interface is static; application logic, persistence, Storage access, authentication-session checks, and the Recovery Agent execute through one Supabase Edge Function.

## Architecture

- **Web interface:** protected static files in `public/`.
- **Backend API:** Supabase Edge Function `assurance-regent-api`.
- **Database:** Supabase Postgres.
- **Documents:** private Supabase Storage bucket `approved-documents`.
- **Application sessions:** hashed session tokens in `app_auth_sessions`.
- **Agent:** OpenAI Agents SDK inside the Supabase Edge Function.
- **OpenAI credential:** Edge Function Secret `OPENAI_API_KEY`.

## Supabase Dashboard files

- `SQL_EDITOR_SETUP.sql` — paste into **SQL Editor** and run.
- `EDGE_FUNCTION_EDITOR_CODE.ts` — paste into the **Edge Functions editor** for a function named `assurance-regent-api`.
- The same files are also kept under `supabase/` for repository organization.
- `SUPABASE_DASHBOARD_ONLY_SETUP.md` — dashboard-only setup steps.

## Browser configuration

`public/supabase-config.js` contains only the public Supabase Project URL and Publishable/anon key. Never place an OpenAI key, Supabase secret/service-role key in a web file or repository.

Persistent application data is written to Supabase. The browser keeps only temporary session/UI state for the current tab/session.
