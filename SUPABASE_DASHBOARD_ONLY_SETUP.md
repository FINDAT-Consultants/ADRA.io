# Assurance Regent — Supabase Dashboard Setup

Everything below is done from the Supabase web Dashboard and its editors.

## 1. Database and Storage

1. Open your Supabase project.
2. Open **SQL Editor** and choose **New query**.
3. Open `supabase/ASSURANCE_REGENT_SUPABASE_ONLY.sql` from this package.
4. Paste the complete SQL into the editor and select **Run**.

The script creates the persistence tables, session table, agent memory/records, learning data, Master Time Schedule data, workbook foundation tables, and the private `approved-documents` Storage bucket.

## 2. Create the Edge Function

1. Open **Edge Functions** in the Supabase Dashboard.
2. Create a function named exactly **`assurance-regent-api`**.
3. Open the function editor.
4. Open `supabase/functions/assurance-regent-api/index.ts` from this package.
5. Replace the editor contents with the complete file.
6. Save and deploy it from the Dashboard.

This function is the application backend. It reads/writes Supabase data, manages Assurance Regent sessions, archives approved files, and runs the OpenAI Agents SDK Recovery Agent.

## 3. Function authentication setting

Open the settings for `assurance-regent-api` and turn **JWT verification off**. Assurance Regent's sign-in and sign-up requests must reach the function before an application session exists.

Private routes remain protected inside the function by the temporary `x-assurance-session` token. Only its SHA-256 hash is stored in `app_auth_sessions`.

## 4. Edge Function Secrets

Open **Edge Function Secrets** and add:

- **`OPENAI_API_KEY`** — a newly rotated OpenAI project API key.
- **`DEVELOPER_BOOTSTRAP_PASSWORD`** — the password for the initial `Dvp` Developer account.
- **`OPENAI_MODEL`** — optional model override.
- **`APP_ALLOWED_ORIGINS`** — optional; set it to the exact published website origin when you want browser-origin restriction.

The OpenAI credential belongs only in Edge Function Secrets. Do not place it in SQL, the function source, GitHub, HTML, or `supabase-config.js`.

## 5. Connect the web interface

In **Project Settings → API**, copy the browser-safe **Project URL** and **Publishable key** (or anon key on projects using the legacy key format).

Edit `public/supabase-config.js` so it contains those two public values:

```js
window.ASSURANCE_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY'
};
```

Do not place privileged credentials in this file.

## 6. Publish the web interface

Publish the project root to your static website. The root `index.html` loads the protected interface and sends every application API request directly to the hosted `assurance-regent-api` Edge Function.

## 7. First sign-in

Use:

- **Username:** `Dvp`
- **Role:** `Developer`
- **Password:** the value stored as the `DEVELOPER_BOOTSTRAP_PASSWORD` Edge Function Secret

The Developer can create companies and additional application accounts from the interface.

## 8. Supabase persistence map

- Settings, companies, application users, document metadata, live HR/finance state, AI thread/activity state → `app_state_documents`
- Hashed application sessions → `app_auth_sessions`
- Agent memory → `agent_memories`
- Tasks and durable records → `system_records`
- Agent action audit trail → `agent_action_log`
- Confirmed coding learning → `agent_learning_mappings`
- Work Activity Hub sessions/messages → `mts_work_sessions`, `mts_messages`
- Approved file objects → private `approved-documents` Storage bucket
- OpenAI API key → **Edge Function Secrets only**

## 9. Verify from the Dashboard

After using the application, open **Table Editor** to confirm new rows/state are being written. Open **Storage** to verify approved document objects. Open **Edge Functions → assurance-regent-api → Logs** to inspect API/agent execution and any errors.
