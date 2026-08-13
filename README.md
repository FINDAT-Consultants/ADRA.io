## Assurance Regent v5.4.0 — Developer Account Governance

This release preserves the v5.3.1 Recovery Agent, voice, microphone, UI and Supabase behavior and adds Developer-controlled account approvals and company service access.

- Self-created Administrator/Employee accounts remain pending until a Developer confirms them.
- Developer Notifications contain Confirm/Reject actions for pending registrations.
- Developers can create and assign Developer accounts, suspend/activate/delete accounts, and reset passwords.
- Administrators cannot grant Developer authority.
- Developers can switch an entire company online/offline and configure the monthly amount, currency and payment instructions shown to blocked company users.
- Company shutdown does not delete operational data; restoring the company returns users to their existing records.
- Database-level session/account/company checks protect normal state and Recovery Agent access.

Run `DEVELOPER_GOVERNANCE_V5_4_0.sql` LAST in Supabase before deploying this website update. See `DEVELOPER_GOVERNANCE_V5_4_0_DEPLOYMENT_GUIDE.txt`.

## Recovery Agent v5.2.1 — Control Center Profile Access Patch

This maintenance release preserves all v5.2.0 agentic operations and fixes the Control Center Profile overlap:

- Recovery AI Operator is hidden whenever Control Center > Profile is open.
- Opening Profile closes/hides any already-open floating Recovery panel.
- Closing Profile restores the Recovery launcher on eligible pages.
- Save Profile and Sign Out actions are visually protected from overlap.
- Sign Out now uses a strong, clear red action style and accessible label/title.
- Small-screen Profile actions stack full-width for easier touch use.
- No Supabase SQL or Edge Function changes are required.

Read `RECOVERY_AGENT_V5_2_1_UI_PATCH.txt` for deployment and testing.

## Recovery Agent v5.2.0 — Proactive Agentic Operations

This package preserves the v5.1 synchronized Recovery Agent page/floating operator and adds:

- Time-aware spoken greetings addressed to the signed-in username.
- Lunch-return and end-of-day proactive routines.
- Notification awareness and proactive notification prompts.
- Guarded multi-step page operation with a six-step safety ceiling per instruction.
- Visible form population and dropdown selection through registered current-page controls.
- Guarded button activation; approval/rejection requires an explicit authorized instruction.
- Recovery Agent document upload and OpenAI file analysis.
- Review of permitted Assurance Regent stored documents without automatic approval.
- Role-scoped CSV, Word-compatible DOC, and PDF report downloads.
- Continued Developer / Administrator / Employee privacy boundaries.
- No OpenAI API secret in browser code.

### Deployment from v5.1

No new database schema is required for v5.2. Replace the website files and redeploy the `recovery-agent` Supabase Edge Function using `RECOVERY_AGENT_EDGE_FUNCTION.ts`.

Read `RECOVERY_AGENT_V5_2_UPGRADE_GUIDE.txt`.

# Assurance Regent v5.0.0 — Recovery Agent Interactive Operator

This build preserves the direct Supabase edition and upgrades Recovery Agent into a persistent, role-aware interactive application operator.

## Highlights

- Floating AI console across every page.
- Commands such as **Open Dashboard**, **Open Payroll**, **Open Projects**, and **Open Recruiting** for authorized roles.
- Continuous page-aware conversation after navigation.
- Developer / Administrator / Employee AI capability tiers.
- Server-side tenant and employee privacy scoping.
- Push-to-talk voice commands and spoken replies through OpenAI audio APIs.
- Supabase audit trail of agent commands and actions.
- No OpenAI API key in browser code.

## Deployment

Read `RECOVERY_AGENT_V5_DEPLOYMENT_GUIDE.txt` and run `RECOVERY_AGENT_V5_SUPABASE_UPDATE.sql` before deploying the replacement `recovery-agent` Edge Function.

The site remains a static Netlify deployment from `public/` with Supabase as the data/Edge Function platform.

### Recovery Agent v5.6 Developer governance
Developer AI can now operate the v5.4 governance layer with exact targets: approve/reject pending accounts, suspend/reactivate accounts, assign system roles, switch company service ON/OFF, update billing/payment details, and delete non-permanent accounts after explicit authorization. See `RECOVERY_AGENT_DEVELOPER_GOVERNANCE_V5_5_0.md` and `RECOVERY_AGENT_V5_5_0_DEPLOYMENT_GUIDE.txt`.

### Recovery Agent v5.6
Recovery Agent can now manage and save permitted profile/settings forms, sign the current user out on explicit instruction, initiate guarded upload workflows, automatically continue after the user chooses a file, and use server-side OpenAI web search for current public information. Local computer file selection remains under browser/OS user control.

### Recovery Agent v5.7
Recovery Agent v5.7 keeps all v5.6 operations and adds direct voice-command submission, an immediate Stop Speaking control, location-aware public research with work-location fallback, downloadable public-research visualizations/documents, and guarded food-order handoff to secure merchant pages after explicit user confirmation.

## v5.8 Leave & Work Status

Operational Capture now includes role-scoped leave applications, Administrator/Developer approvals, WFH/work-location status, dashboard analytics, and dedicated Recovery Agent leave/work-status tools. Deploy `LEAVE_WORK_STATUS_V5_8_0.sql` after the v5.4 governance migration.


## v5.8.2 microphone session update
- Recovery Agent now reuses an already-authorized microphone stream within the current page session, so later Mic clicks start immediately without repeated browser prompts.
- Recorded speech continues to submit directly to Recovery Agent after manual Stop or silence detection; it is not staged in the text entry box.
- First-time browser microphone permission remains controlled by the browser, matching ChatGPT web behavior.

### Jivan v5.9.0
The Assurance Regent agentic operator is named **Jivan**. Users may address it by name in typed or voice-transcribed commands. v5.9.0 also adds a persistent Supabase-backed delegated-work queue for non-interactive research, analysis, role-scoped exports, report generation, visualization and stored-document review while the user continues working in other Assurance Regent sections. Local file choosers remain under browser/operating-system control; Jivan can initiate the chooser and automatically continue after the user selects the file.
