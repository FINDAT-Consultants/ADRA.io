# Implemented changes

This build includes the requested role, workflow, OpenAI execution, navigation, and responsive-interface changes.

## Access and authority

- Hidden bootstrap Developer account: `Dvp`. The requested password form `Abcd\@1234` is accepted; `Abcd@1234` is normalized to the same default. Set `DEVELOPER_BOOTSTRAP_PASSWORD` for deployment hardening.
- Three application roles: Developer, Administrator, Employee.
- Developer: full authority, company creation, company/user administration, data controls, Administrator/Developer assignment.
- Administrator: company-scoped administration, Employee-to-Administrator promotion, Supervisor/Head of Department assignment, settings/master-data control, approvals/rejections.
- Employee: restricted views, own work-session controls, own controlled document scope, registration with employee ID/company code/name/job title.
- Live API authorization uses an HttpOnly session cookie. The raw token is not available to browser JavaScript; its SHA-256 hash and user binding are stored in Supabase rather than browser Web Storage or server memory.
- Developer identity is hidden from the normal user directory and registration categories.

## OpenAI execution

- OpenAI-powered agent/document-analysis work requires `OPENAI_API_KEY` and uses `@openai/agents`.
- No local-model, canned-response, or browser-local AI fallback is used.
- The OpenAI key stays on the deployed server/API layer; it is not exposed in browser JavaScript.

## Approval, rejection, and rework

- Only Developer/Administrator users may approve or reject controlled items.
- Administrator reviews are company-scoped.
- Rejected Work Activity documents return to the employee as `REWORK_REQUIRED` with a next-day rework due timestamp.
- Replacement uploads are revision-linked to the rejected document and preserve the Work Activity session trace.
- A rework session cannot be clocked out until an updated replacement document has been submitted.
- Final clock-out stores the newest clock-out location and the interface displays elapsed task days.

## Work Activity progress

- Below 50%: red / Incomplete.
- 50–79%: yellow / Moderate.
- 80–99%: orange / Near completion.
- 100%: green / Complete.

## Interface

- Removed the `Add time entry` button.
- Management intelligence, Operational capture, and Assurance engine are collapsible dropdown navigation groups and start collapsed to reduce visual crowding.
- Reduced oversized text/control dimensions and added responsive breakpoints for desktop, small laptops, tablets/iPads, phones, portrait, and landscape layouts.
- Shortened explanatory copy and removed prototype-like visible wording.
## Direct index preview
- Removed the full-page `Application API required` replacement shown when `index.html` is opened directly.
- Direct `file://` opening now renders the normal styled interface in read-only preview mode instead of forcing sign-in or an API warning screen.
- OpenAI/secure API execution remains server-side; direct preview does not introduce a browser-local AI fallback.


## Developer Company & Executive setup
- Added a Developer-only **Add company & Executive** action directly inside the Company structure card.
- Added executive leadership choices: Country Director (CD), Country Senior Partner (CSP), Managing Director (MD), and Chief Executive Officer (CEO).
- The Developer selects an existing registered user, sees the user's profile picture before saving, and assigns the system role Administrator.
- Save creates the company, binds the executive as company leadership, moves the selected account into that company, and applies Administrator authority plus the selected executive title.
- The Company card immediately displays the saved company name and executive profile.

## Supabase-only durable persistence

- Removed durable browser `localStorage` persistence from the live UI. Direct-file preview uses memory only and cannot become the system of record.
- Added `assurance_regent_state` in Supabase for Control Center state, live operational engine state, AI advisor threads, visible agent activity, and trained intelligence-model metadata.
- Existing Supabase tables remain the source of truth for MTS sessions/messages, memory, stored records/action logs, persistent agent sessions, and learned activity mappings.
- Controlled uploaded documents are now stored in the private `assurance-regent-files` Supabase Storage bucket; database state stores only metadata/storage paths. Authorized users receive short-lived signed URLs to open documents.
- The server refuses to operate without Supabase server credentials, preventing accidental fallback to local server JSON for live user data.
- Live authentication now uses an HttpOnly cookie with a Supabase-backed, SHA-256-hashed session registry; browser `sessionStorage` is no longer used.
- Added migration `005_supabase_only_persistence.sql`, a non-destructive existing-project update SQL file, and a separate fresh-project combined setup file for dashboard-only installation.
- Removed legacy server JSON write fallbacks from active memory, records, conversation session, learning, and MTS persistence modules; live durable writes now have a single Supabase path.
- Removed the shared persisted `currentUserId`/`signedIn` login state so simultaneous users are resolved from their own authenticated API sessions instead of a last-login global value.
