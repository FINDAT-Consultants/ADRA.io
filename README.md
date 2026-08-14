# Assurance Regent v6.0.0 — Recovery Assurance & Accounting
- **Independent Auditor / Internal Audit** — read-only Recovery Assurance and Audit Centre access; no finance approval or journal authorization.

Version 6.0 preserves the complete Jivan/Assurance Regent v5.13 application and adds the production cost-recovery controls envisioned by the Recovery Passport concept.

### v6 highlights

- Employee × project × month five-key Recovery Passport: **Evidence, Capacity, Eligibility, Budget, Approval**.
- Any failed key blocks recovery while retaining the proposed cost and deterministic remediation.
- Normalized Supabase tables for immutable Passport versions, key results, supporting evidence, human assurance, journals and audit events.
- Configurable donor-rule versions: evidence requirements, hourly ceilings, personnel-charge ceilings, currency controls and administration restrictions.
- **Recovery Exceptions** for Supervisor/HOD/Project/Programs management-by-exception without exposing payroll rates or accounting formulas.
- **Recovery Assurance** for Finance/Administrator/CEO/Developer with evidence-to-charge traceability, immutable hashes, human approval/rejection history and controlled journal handoff.
- **Recovery Audit Centre** with deterministic tests and append-only audit evidence.
- Dashboard recovery-risk forecasting.
- Jivan can explain recovery exceptions, create explicitly requested immutable snapshots, create journal drafts after human Finance Assurance, and run audits; Jivan cannot make the human financial approval or authorize/post a journal.
- Existing HR, leave/WFH, departmental authority, continuous voice, microphone reuse, file handoff, background delegation, governance and newest-first pagination are retained.

Deployment: run `RECOVERY_ASSURANCE_V6_0_0.sql`, verify with `RECOVERY_ASSURANCE_V6_0_0_VERIFY.sql`, deploy the updated `recovery-agent` Edge Function, then deploy the frontend. See `RECOVERY_ASSURANCE_V6_0_0_DEPLOYMENT_GUIDE.txt`.

---

## Jivan v5.13.0
Persistent microphone readiness, direct minimize/fresh-chat commands and reliable user-activated file upload handoff.

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


### Jivan v5.10.0
This release adds newest-first table ordering and functional company authority. Developer is system-wide; CEO is overall company authority; HR Manager owns people/leave/recruiting/onboarding controls; Finance Manager owns payroll/finance review controls; Project Manager owns managed project/team work; Programs Manager/Director owns program/project portfolio oversight; supervisors/HODs remain team-scoped; Employee remains personal/limited. The country shown in Leave & Work Status is taken from the company registration record. Once recorded, that original registration country is locked in the normal governance flow. Background-task results remain in the Background Tasks panel rather than lingering in the main conversation.

### Jivan v5.11.0

- Uses one locked natural browser speech voice throughout greetings, analysis, confirmations, proactive messages, and sign-out.
- Does not switch to a different robotic TTS engine mid-session; if the chosen human voice is unavailable, the text remains visible instead.
- Adds wake-word listening for “Jivan” after microphone permission has already been granted to the Assurance Regent site.
- Saying only “Jivan” makes the agent answer “Yes. I’m listening.” and automatically begin command recording.
- Saying “Jivan, <command>” can submit the command directly without pressing Mic or Send.
- Wake listening pauses while Jivan is speaking, while recording is active, while the tab is hidden, and after sign-out.
- Adds Wake controls to the main Jivan page and floating operator.
- No new SQL migration or Edge Function update is required for this release.

### Jivan v5.11.1 wake reliability hotfix

- Wake mode now self-restarts when browser speech recognition goes idle or terminates.
- Wake-word matching responds to interim and final recognition results and common Jivan/Jeevan variants.
- If browser speech recognition is unavailable or repeatedly fails, Jivan can fall back to the already-authorized microphone stream plus the existing secure transcription route for wake-word detection.
- The Wake indicator now distinguishes active listening from reconnecting.


### Jivan v5.13.0
Wake-word mode was removed and replaced by continuous turn-taking voice conversation. Start Voice conversation once, speak naturally, pause to submit, hear Jivan respond, then continue speaking hands-free until End voice is selected.

## v6.1 Scalability & Resilience
Assurance Regent v6.1 adds bounded browser request concurrency, read coalescing/caching, coalesced state writes, multi-tab background-worker leadership, jittered polling, database hot-path indexes, authenticated Jivan rate limiting, incident telemetry and a senior-authority System Health workspace. Jivan may automatically requeue stale delegated tasks and diagnose reliability incidents, but cannot self-modify code/security or alter business/financial records as a repair.

Run `SCALABILITY_RESILIENCE_V6_1_0.sql` after the v6.0 migration and verify with `SCALABILITY_RESILIENCE_V6_1_0_VERIFY.sql`.

## v6.2.0 — Developer Jivan Studio
Developer-only Jivan Studio adds a versioned Agent Builder, specialist-agent orchestration, guarded external email/WhatsApp/voice-call connectors, engineering diagnostics, policy/activity history and an original holographic command visualization. Saved Studio preferences affect subsequent Jivan requests through the active server-side policy, but cannot override built-in role, tenant, privacy, HR, financial, Recovery Assurance or destructive-action controls. Optional outbound providers require server-side credentials; inbound messaging/calling requires separate webhook integrations.

## Assurance Regent v6.3.0 — Unified Developer Holographic Jivan Console

v6.3.0 preserves the v6.2 Developer Jivan Studio and all earlier Assurance Regent capabilities, but consolidates the Developer experience into one responsive Jivan command console. The normal conversation, Agent Builder, specialist agents, communications, engineering and activity modules switch inside the same container.

Developer-only presentation additions include a procedural holographic intelligence core, live listening/analyzing/routing/executing/speaking/completion/error states, internal conversation scrolling, execution-stage progress visualization, specialist/connector/system telemetry, and an original mission-control response style. The holographic percentages represent client execution-stage progress and are not model-confidence scores.

Non-Developer users keep the existing simplified Jivan interface. Jivan's voice, continuous voice conversation, uploads, background work, Recovery Assurance, HR, departmental authority, System Health and security boundaries remain intact. No new v6.3 database migration is required; the v6.2 Jivan Studio schema remains the persistence layer. Deploy the updated `recovery-agent` Edge Function to activate the Developer response-presentation rules.



## v6.3.1 — Natural Jivan Response Behavior
- Restores task-first, instruction-specific Jivan responses across roles.
- Removes the forced Developer status-first / STATUS-ANALYSIS-EXECUTION-RESULT-NEXT template.
- Keeps the v6.3 holographic Developer console and its live visual telemetry.
- Uses structured status/diagnostic headings only when requested or genuinely useful for technical diagnostics.
- No SQL migration; update the recovery-agent Edge Function and frontend.

## v6.3.3 — Hologram Performance & Header Cleanup
- Developer hologram now defaults to a performance mode: idle visuals are static and motion activates only during live Jivan work.
- Hologram DOM telemetry writes are deduplicated, hidden Studio modes stop rendering the overlay, and animations pause when the browser tab is hidden.
- Expensive blur/backdrop-filter/shadow effects are reduced in Developer hologram mode.
- The Developer Intelligence Channel header no longer shows the additional title/subtitle underneath it.
- All v6.3.2 Jivan tools, natural responses, voice, Studio, communications, specialist agents and security boundaries are preserved.


### v6.3.4 — Compact Developer Jivan Console & Continuous Speech
The Developer Jivan command surface is now substantially smaller and laptop-friendly, with viewport-aware sizing and compact hologram/telemetry controls. On normal desktop/laptop Jivan views the outer page scrollbar is suppressed while the internal conversation remains scrollable as needed. Jivan speech playback now uses smaller resilient chunks, pause-resume heartbeat protection and retry behavior so longer answers continue speaking instead of ending after an early sentence.

## v6.3.5 — Floating Jivan Quick Mic
- Adds a retractable circular microphone to the left of the floating Jivan AI Operator tab.
- Uses a rotating activity ring while the continuous voice channel is active.
- Voice activity detection submits the user's turn after approximately 720 ms of silence.
- The quick mic retracts while Jivan speaks and the existing launcher waveform takes over, then listening resumes afterward.
- Already-granted browser microphone permission can automatically reactivate the voice channel after sign-in without an application-level prompt.
- Long-response browser speech playback uses smaller chunks, a resume heartbeat, and bounded same-voice retries for improved continuity.


## v6.3.9 Jivan Voice Access
The sign-in dialog includes a centered Jivan microphone for voice instructions or enrolled speaker recognition. Account registration can capture three private voice samples. Deploy `JIVAN_VOICE_ACCESS_V6_3_9.sql` and the `voice-access` Supabase Edge Function before enabling voice sign-in in production.
