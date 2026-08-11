# Assurance Regent — Supabase Dashboard-only setup

This edition uses only the static web interface + Supabase Postgres/Storage + the `assurance-regent-api` Edge Function. No local server, Bash, CMD, or CLI is required.

## 1. Run the SQL

In Supabase open **SQL Editor → New query**. Paste and run `ASSURANCE_REGENT_SQL_EDITOR_SETUP.sql`.

After it finishes, **Table Editor** should immediately show at least these application tables:

- `app_users` — includes the fixed Developer account `DVP`
- `app_companies` — includes the visible `ASSURANCE` company code
- `app_settings`
- `app_documents`
- `app_reviews`
- `app_live_records`
- `app_state_documents`
- `app_auth_sessions`
- `agent_memories`, `agent_action_log`, `agent_learning_mappings`
- `mts_work_sessions`, `mts_messages`

## 2. Replace the Edge Function code

Open **Edge Functions → assurance-regent-api → Edit**. Replace the entire function with `ASSURANCE_REGENT_EDGE_FUNCTION_EDITOR.ts`, save, and deploy from the Dashboard.

Keep **Verify JWT disabled** for this function because the website is using the new publishable API key; the function validates the `apikey` header itself and protects private routes with its own server-side session table.

## 3. Edge Function secrets

Only AI features require `OPENAI_API_KEY` in **Edge Functions → Secrets**. `OPENAI_MODEL` and `APP_ALLOWED_ORIGINS` are optional. No Developer bootstrap secret is required.

## 4. Sign in

The sign-in screen now asks only for **Username or Email address** and **Password**.

Fixed Developer account:

- Username: `DVP`
- Password: `Abcd@1234`

The password is stored in Supabase only as a salted scrypt hash.

For ordinary sign-up, the included Assurance Regent company code is `ASSURANCE`. Each new account is written as its own row in `app_users`.

## 5. Browser persistence

The application runtime contains no `localStorage`, `sessionStorage`, or IndexedDB persistence. The Edge session token is held only in page memory, so reloading the page requires signing in again. Durable users, settings, operational records, messages, documents, agent state, and work data are saved to Supabase.

## 6. Confirm persistence

From the Edge Function Dashboard tester, call the application envelope with:

- method: `POST`
- header `apikey`: your project publishable key
- body: `{"method":"GET","path":"/api/health","query":{},"body":null}`

The response contains `persistence.users`, `persistence.companies`, `persistence.live_records`, and `persistence.developer_ready`. The health call also migrates previous Supabase JSON state into the new normalized tables.
