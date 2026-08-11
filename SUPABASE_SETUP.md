# Assurance Regent — Supabase persistence setup

This build uses Supabase as the durable store for mutable application data. With `SUPABASE_REQUIRED=true`, the production server refuses to operate without working Supabase server credentials and the required schema.

## 1. Run the SQL schema

Open your Supabase project → SQL Editor, paste the complete contents of:

`supabase/ASSURANCE_REGENT_SUPABASE_SETUP.sql`

Run it once. The script is designed to be idempotent and creates/updates:

- workbook foundation tables
- agent memory, session, record and audit tables
- MTS work-session and internal-message tables
- `app_state_documents` for control-center state, live state, AI brain state, activity traces and trained model state
- `app_auth_sessions` for hashed login sessions
- the private `approved-documents` Storage bucket
- a server-only `get_server_secret()` RPC for retrieving named Supabase Vault secrets
- RLS on server-only tables with no browser policies

## 2. Store the OpenAI key in Supabase Vault

Do **not** put the OpenAI API key in GitHub, `index.html`, protected browser assets, or a public table.

In Supabase SQL Editor, replace the placeholder locally and run:

```sql
select vault.create_secret(
  'PASTE_YOUR_OPENAI_API_KEY_HERE',
  'OPENAI_API_KEY',
  'Assurance Regent OpenAI server key'
);
```

If a secret named `OPENAI_API_KEY` already exists, rotate it rather than creating duplicates:

```sql
select id, name, updated_at
from vault.decrypted_secrets
where name = 'OPENAI_API_KEY';

select vault.update_secret(
  'PASTE_SECRET_UUID_HERE',
  'PASTE_NEW_OPENAI_API_KEY_HERE',
  'OPENAI_API_KEY',
  'Assurance Regent OpenAI server key'
);
```

Never send the actual API key in chat or commit it to the repository.

## 3. Configure the Node server host

Set these environment variables on the service that runs `node server.js`:

```text
NODE_ENV=production
SUPABASE_REQUIRED=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_SECRET_KEY
OPENAI_MODEL=gpt-5.6
DEVELOPER_BOOTSTRAP_PASSWORD=YOUR_PRIVATE_STRONG_PASSWORD
```

`OPENAI_API_KEY` can remain blank because the server loads the named `OPENAI_API_KEY` secret from Supabase Vault at startup.

The Supabase **secret/service-role credential is server-only**. Never place it in GitHub Pages or browser JavaScript.

## 4. Start/redeploy

```bash
npm install
npm run check
npm start
```

Then open `/api/health`. A correctly configured deployment reports Supabase storage enabled and `openai_secret_source` as `supabase-vault` (unless you deliberately supplied `OPENAI_API_KEY` directly in the server environment).

## Important: GitHub Pages

GitHub Pages can host the static protected interface, but it cannot execute this Express/Node API. Sign-in, Supabase server writes, OpenAI agent calls and server-side document handling require `server.js` to run on a Node-capable host. Do not put Supabase secret keys or the OpenAI key into GitHub Pages to work around that limitation.

## Mutable data now persisted to Supabase

The production runtime persists user/account settings, company/user records, uploaded-document metadata/content state, approved document archive copies, live employees/projects/payroll/calendar/time entries/recruitment/onboarding state, MTS sessions/messages, agent memories, learning mappings, conversations, AI brain messages/learning, activity traces, system records/tasks/audit actions, trained ML state and hashed login sessions to Supabase.

Bundled reference/training assets (formula catalogs, source-document knowledge and historical training references) remain read-only files in the application package; they are not mutable user data.
