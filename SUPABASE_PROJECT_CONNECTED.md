# Assurance Regent — Supabase Project Connected

This build is preconfigured for the **public/browser-safe** connection to:

- Project: Assurance Regent
- Project ID: `fubqwljypdiojpbdunjc`
- Region: `eu-west-1`
- Edge Function: `assurance-regent-api`

The browser file `public/supabase-config.js` contains only the project URL and the project's publishable key.

## Dashboard-only activation

### 1. Create the database objects
Open **Database → SQL Editor → New query**. Paste the complete contents of `ASSURANCE_REGENT_SQL_EDITOR_SETUP.sql`, then select **Run**.

After it succeeds, open **Table Editor**. You should see Assurance Regent tables including:

- `app_state_documents`
- `app_auth_sessions`
- `agent_memories`
- `agent_action_log`
- `system_records`
- `mts_work_sessions`
- `mts_messages`
- `workbook_employees`
- `workbook_projects`
- `workbook_payroll`
- `workbook_calendar`
- `workbook_time_entries`

The SQL also creates the private Storage bucket `approved-documents`.

### 2. Create the Edge Function in the Dashboard editor
Open **Edge Functions → Deploy a new function → Via Editor**.

Use this exact function name:

`assurance-regent-api`

Replace the sample function code with the complete contents of `ASSURANCE_REGENT_EDGE_FUNCTION_EDITOR.ts`, then deploy it.

### 3. Turn OFF built-in JWT verification for this function
The website uses Supabase's newer `sb_publishable_*` key, not a legacy JWT API key. In the Edge Function configuration/details, disable the built-in **Verify JWT** / legacy JWT verification option.

The function performs its own publishable-key check and then uses Assurance Regent's hashed application session for private routes.

### 4. Add only the application secrets
Open **Edge Functions → Secrets** and add:

- `OPENAI_API_KEY` — your newly rotated OpenAI API key
- `DEVELOPER_BOOTSTRAP_PASSWORD` — a strong password you choose for the initial `Dvp` Developer account
- `OPENAI_MODEL` — optional; leave absent to use the build default
- `APP_ALLOWED_ORIGINS` — optional; set to your deployed website origin when ready

Do **not** manually add the Supabase secret key or legacy JWT secret to browser code. Hosted Edge Functions automatically receive `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, and `SUPABASE_SECRET_KEYS` from the project.

### 5. Test from the Supabase Dashboard
Open the `assurance-regent-api` function and choose **Test**.

Set method to **POST**.

Add header:

- `Content-Type`: `application/json`
- `apikey`: use the project's publishable key from **Settings → API Keys**

Use this request body:

```json
{
  "method": "GET",
  "path": "/api/health",
  "query": {},
  "body": null
}
```

A healthy deployment returns HTTP 200 and includes:

```json
{
  "ok": true,
  "runtime": "supabase-edge-only",
  "database": "supabase-postgres",
  "storage": "supabase-storage"
}
```

### 6. Confirm persistence
After signing in to the website and saving data, `app_state_documents` will contain the main application state and the domain tables will populate as their features are used. Login sessions appear in `app_auth_sessions` as hashes only.
