# Assurance Regent — Supabase-only build

This build uses a static protected web interface and the hosted Supabase Edge Function `assurance-regent-api`. There is no local application server.

Use these files in the Supabase Dashboard:

- `ASSURANCE_REGENT_SQL_EDITOR_SETUP.sql` — database/storage setup
- `ASSURANCE_REGENT_EDGE_FUNCTION_EDITOR.ts` — Edge Function editor code
- `SUPABASE_DASHBOARD_ONLY_SETUP.md` — Dashboard-only steps
- `public/supabase-config.js` — browser-safe project URL and publishable key

Authentication: username **or email address** + password. Fixed Developer account: `DVP`. All durable application data is persisted in Supabase; browser storage persistence is disabled.
