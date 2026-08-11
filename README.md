# Assurance Regent — Supabase-Only Edge Build

This edition has no local application server. The static protected web interface calls the hosted Supabase Edge Function `assurance-regent-api`; persistent data is stored in Supabase Postgres and Storage.

Start with `SUPABASE_PROJECT_CONNECTED.md`.

Important files:

- `public/supabase-config.js` — preconfigured browser-safe project URL + publishable key
- `ASSURANCE_REGENT_SQL_EDITOR_SETUP.sql` — paste into Supabase SQL Editor
- `ASSURANCE_REGENT_EDGE_FUNCTION_EDITOR.ts` — paste into the Supabase Edge Function editor
- `SUPABASE_PROJECT_CONNECTED.md` — exact Dashboard-only setup and test steps

Never put OpenAI keys, Supabase secret keys, service-role keys, S3 secrets, or JWT signing secrets into the static website or GitHub repository.
