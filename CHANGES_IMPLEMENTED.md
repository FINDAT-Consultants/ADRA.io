# v6.0.0 — Recovery Assurance & Accounting
- Added **Auditor / Internal Audit** as a senior read-only recovery-assurance role; CEO/Developer assignment only.

- Added normalized Recovery Assurance database layer with RLS and guarded RPC access.
- Added immutable Recovery Passport snapshots, five-key results, evidence links and human assurance events.
- Added server-side Recovery Gate recomputation and source/payload hashes.
- Added configurable versioned donor rules and project-budget integration.
- Added employee × project × month Recovery Passport engine with counterfactual remediation.
- Added Recovery Exceptions management-by-exception view for Supervisor/HOD/Project/Programs roles, scoped to managed employees and hiding payroll/accounting details.
- Added Finance Recovery Assurance workspace with evidence-to-charge traceability.
- Added human Supervisor/Finance Assurance APPROVE and REJECT controls; rejection reason required and decisions are append-only.
- Added controlled balanced journal drafts, human journal approval, cancellation-before-export and CSV export.
- Added Dashboard recovery-risk forecasting.
- Added deterministic Recovery Audit Centre and append-only audit events.
- Added Jivan recovery tools with strict restricted-AI boundaries: no finance assurance decisions and no journal authorization/posting.
- Preserved all v5.13 Jivan, voice, upload, background, HR, leave, governance and departmental-authority features.

---

# v5.8.1 — Control Center Recovery Operator visibility

- Recovery AI Operator now hides for Control Center Profile, Settings, Reviews, and Notifications.
- Both the launcher and any already-open floating panel are force-hidden.
- Closing the Control Center restores the operator on eligible pages.
- Documents behavior remains unchanged.
- No Supabase SQL or Recovery Agent Edge Function change is required.

# v5.4.0 — Developer Governance & Company Service Control

- Added Developer approval for every self-registered Administrator and Employee account.
- Added Developer Notifications Confirm/Reject actions for pending accounts.
- Added delegated Developer account creation and Developer role assignment, protected from Administrator escalation.
- Added Developer account lifecycle controls: approve/activate, suspend, reject, delete, and reset password.
- Added Developer company service directory showing connected users, billing amount/currency/payment instructions, and ON/OFF access toggle.
- Company OFF status blocks all Administrator/Employee sessions at the Supabase RPC layer without deleting operational data; restoring ON returns access to preserved data.
- Added periodic session/company-access revalidation and Recovery Agent access gating.
- Added v5.4.0 SQL verification and deployment guide.

## v5.2.1 — Control Center Profile / Sign Out accessibility

- Hid the floating Recovery AI Operator whenever Control Center > Profile is open.
- Added a Control Center panel event so the operator closes immediately when Profile opens.
- Restored the Recovery launcher after Profile closes on eligible pages.
- Added CSS-level fail-safe hiding for both the Recovery launcher and floating panel during Profile use.
- Strengthened the Sign Out button with a vivid red treatment, hover/focus states, and explicit accessibility text.
- Improved Profile action behavior on small screens.
- Updated frontend cache-busting from 5.2.0 to 5.2.1.

## v5.2.0 — Proactive greetings, controlled UI operation and documents

- Added username-addressed morning, midday, afternoon and evening greetings.
- Added lunch-return detection after a sustained midday browser absence.
- Added end-of-day/clock-out farewell routine.
- Added proactive notification awareness and spoken notification prompts.
- Added current-page UI catalog for safe form fields and buttons.
- Added multi-step agent continuation with a six-step safety ceiling.
- Added guarded field population, dropdown selection and button activation.
- Added explicit-authorization guard for approve/reject/destructive controls.
- Added Recovery Agent upload next to Send and document analysis through OpenAI Responses file/image input.
- Added permitted stored-document review without automatic approval.
- Added role-scoped CSV, Word-compatible DOC and PDF downloads with in-chat download links.
- Preserved v5.1 synchronized conversation, floating-operator hiding on the Recovery Agent page, clear-conversation synchronization, mute/unmute and push-to-talk behavior.

# Assurance Regent v5.0.0

## Recovery Agent Interactive Operator

- Added a persistent floating Recovery Agent console that remains available when the agent navigates between Assurance Regent sections.
- Added role-aware OpenAI function tools for safe UI navigation, reporting-month changes, controlled searches, employee opening (Admin/Developer), company tabs, recruiting tabs, profile and control panels.
- Added current-page context to every Recovery Agent request.
- Added Developer AI, Administrator AI and guarded Employee AI tiers.
- Added employee privacy scoping so Employee AI receives primarily the signed-in employee's own payroll/time/onboarding/work records rather than company-wide sensitive datasets.
- Added company isolation for Administrator AI and retained system-wide scope only for Developer AI.
- Added a browser-side second permission check before returned AI UI actions execute.
- Added push-to-talk microphone capture and OpenAI transcription through the Supabase Edge Function.
- Added OpenAI text-to-speech responses with a user mute/unmute control.
- Added Supabase Recovery Agent audit logging and role-scoped audit retrieval RPC.
- Preserved the direct Supabase/Netlify architecture; no Express server was reintroduced.
- OpenAI secret keys remain server-side in Supabase Edge Function Secrets.


## v5.1.0 — Unified Recovery Agent interface
- Floating Recovery AI Operator is hidden on the dedicated Recovery Agent page.
- Dedicated page and floating operator now share one conversation and one clear action.
- Added Clear button to floating operator; either Clear button clears the same Supabase-backed thread.
- Fixed floating operator overlap with the dedicated Recovery Agent Send control.
- Added working mute/unmute behavior, including pausing and resuming an in-progress spoken reply.
- Microphone buttons now visibly switch to Stop recording while active and synchronize across both Recovery Agent surfaces.
- Added microphone permission-state handling; previously granted browser permission starts recording directly.
- Browser tab title changed to Assurance Regent System.
- Assurance Regent mark configured as favicon and Apple touch icon.

## v5.5.0 — Recovery Agent Developer Governance
- Added exact Developer-only AI tools for pending-account approval/rejection, suspension/reactivation, role assignment, company service/billing control, and guarded account deletion.
- Recovery Agent visibly opens Notifications before pending-account decisions and Settings before account/company governance actions.
- Developer governance tools are not exposed to Administrator or Employee AI tiers.
- Added exact account/company ID targeting from server-scoped context to prevent ambiguous generic button selection.
- Added explicit-instruction checks plus browser confirmation for high-impact governance operations.
- Added client-side execution audit entries through the existing Assurance Regent Agent audit RPC.
- Strengthened generic Settings control classification so authority and company service/billing controls are treated as sensitive.
- Password reset remains a visible Developer Settings workflow and is not exposed as an autonomous AI credential tool.

## v5.6.0 — Agent profile, upload and public-web operations
- Added first-class Recovery Agent tools to save the signed-in user's profile, save permitted Settings, and sign out on explicit instruction.
- Added Agent-initiated upload workflows for Recovery Agent analysis, Control Center Documents, and profile photos.
- User file selection remains browser/OS controlled; after selection the configured workflow continues automatically.
- Added OpenAI built-in web search to Recovery Agent for current public information, with instructions preventing confidential Assurance Regent data from being used in public search queries.
- Preserved Developer Governance v5.5 exact-target account/company controls and all role guardrails.

## v5.7.0 — Direct Voice + Location-Aware Research
- Microphone transcription now submits directly to Recovery Agent instead of filling the prompt field first.
- Added square Stop Speaking control between Clear and Voice in the floating operator.
- Added silent refresh of device location only when geolocation permission was already granted; otherwise uses work-location fallback when available.
- Expanded public web research with public contact lookup guidance.
- Added downloadable research SVG visualizations and Word/PDF/TXT research documents.
- Added explicit-confirmation food-order handoff to secure merchant ordering pages.
- Preserved all v5.6 Developer governance, profile/settings/session, upload, document, voice and security functions.

## v5.8.0 — Leave Management & Work Location
- Added Operational Capture > Leave & Work Status.
- Added role-scoped Supabase leave policy, request, work-status and history storage.
- Added annual, maternity, paternity, sick, compassionate/bereavement, family-responsibility and other leave workflows.
- Added company-configurable leave policy controls with Zambia-oriented statutory-minimum defaults and legal-policy distinction.
- Added Administrator/Developer approval/rejection workflow and leave notifications.
- Added WFH/Office/Field/Travel/Off Duty employee self-service status and dashboard badges.
- Added Dashboard leave/WFH KPIs, current work-location people list and pending-leave attention feed.
- Added Recovery Agent tools: apply_leave_request, decide_leave_request, set_employee_work_status.
- Added explicit permission + confirmation guardrails around AI leave decisions.


## v5.8.2 microphone session update
- Recovery Agent now reuses an already-authorized microphone stream within the current page session, so later Mic clicks start immediately without repeated browser prompts.
- Recorded speech continues to submit directly to Recovery Agent after manual Stop or silence detection; it is not staged in the text entry box.
- First-time browser microphone permission remains controlled by the browser, matching ChatGPT web behavior.

## v5.9.0 — Jivan named operator and delegated work
- Renamed the user-facing Recovery Agent identity to **Jivan** and taught the system prompt to recognize direct address by name in text and transcribed voice instructions.
- Expanded role-aware foreground multi-step execution limits while preserving authorization and confirmation guardrails.
- Added Supabase-backed delegated task queue with queued/running/waiting/completed/failed/cancelled states.
- Added Jivan task status controls in the full Agent interface and floating operator badge.
- Added background-safe research, analysis, exports, report/document generation, visualization and stored-document review without taking over the user's current page.
- Task state persists in Supabase and resumes when Assurance Regent is reopened if a task was not completed.
- Existing file-upload behavior remains governed by browser/OS file selection; after selection, Jivan automatically continues the requested upload/analyze workflow.


## v5.10.0 — Newest-first tables & departmental authority
- All paginated operational tables are fed newest-first so page 1 contains the latest records and older records move to later pages.
- Added functional authority tiers for Human Resources Manager, Finance Manager, Project Manager, Programs Manager/Director, CEO and existing Developer/Administrator/Employee levels.
- HR can manage company leave/work policy and approve/reject leave; Finance receives finance/payroll review scope; Project/Programs managers receive managed-team/project review scope; CEO receives company-wide executive scope; Developer remains system-wide.
- Company and employee directories, time/work evidence, Jivan exports and stored-document analysis now respect functional/managed-team scope in the interface.
- Leave policy country label now comes from the company registered-country field rather than a hard-coded country. Existing companies without a stored registration country display “Registration country not set” until Developer records it.
- Background-task completion text no longer accumulates in the main Jivan chat. Clear Conversation clears both Jivan surfaces and legacy task-completion chat rows are ignored.
- Explicit “Jivan, sign me out” / “log me out” commands sign out immediately without an extra Jivan confirmation.
- Jivan Edge Function now understands CEO/HR/Finance/Project/Programs/team-manager scopes and does not collapse those accounts to ordinary Employee AI.


## v5.11.0 — Jivan consistent human voice and wake word
- Locks one natural browser voice and uses it consistently throughout the signed-in session.
- Removes mid-conversation fallback to a different robotic TTS voice.
- Adds automatic wake-word listening for “Jivan” after microphone permission has already been granted.
- Saying only “Jivan” acknowledges the user and automatically begins command capture; “Jivan, <command>” can be submitted directly.
- Wake listening pauses during Jivan speech, recordings, hidden-tab periods and sign-out.


## v5.12.0 — Jivan continuous voice conversation
- Removed the non-functional wake-word mode.
- Added a user-started continuous voice session with voice-activity detection, automatic end-of-turn submission, Jivan speech, and automatic return to listening.
- Prevented Jivan from listening to his own speech by pausing microphone monitoring during spoken responses.


## v5.13.0 — Microphone persistence, direct controls and upload reliability
- Reuses browser-persisted microphone permission without auto-prompting when permission is not already granted.
- Remembers continuous voice preference and resumes it only with an already-granted browser permission.
- Jivan can minimize/close itself by direct command.
- Clear/new-chat commands fully reset both chat surfaces and local conversation context.
- Upload instructions are intercepted synchronously for reliable file-picker opening; voice instructions get a one-click fallback.

## v6.1.0 — Scalability, Traffic Management & Jivan Resilience
- Bounded six-request client network pool with timeouts and safe-read retry/backoff.
- Read RPC in-flight coalescing and short-lived cache.
- Debounced/latest-only shared-state persistence to prevent write-queue growth.
- Browser multi-tab leader lease so one tab claims Jivan background work and runs resilience monitoring.
- Jittered/visibility-aware polling for session, Control Center and health activity.
- Supabase hot-path indexes for auth, AI, HR and Recovery Assurance.
- Authenticated per-user Jivan rate limiting.
- System incident register and System Health workspace.
- Jivan safe auto-recovery for stale background tasks; destructive/business/security self-repair remains prohibited.
- Immutable caching for hashed Netlify assets with index revalidation.

## v6.2.0 — Developer Jivan Studio
- Added Developer-only Jivan Studio above the ordinary Jivan workspace.
- Added original holographic telemetry view with responsive/reduced-motion behavior.
- Added versioned Agent Builder policy with Developer-only or deliberate all-role scope.
- Added configurable specialist-agent team and live specialist advisory routing.
- Added Resend outbound email and Twilio WhatsApp / outbound voice-call connector controls.
- External sends/calls remain Developer-only, connector-gated, rate-limited, audited and browser-confirmed.
- Added Developer engineering diagnostics, stale-task recovery, cache refresh and System Health launch.
- Added Studio policy version history and external communication history.
- Preserved all v6.1 scalability, v6.0 Recovery Assurance, HR, governance, voice and background-task behavior.

## v6.3.0 — Unified Developer Holographic Jivan Console

- Replaced the separate Developer Studio + chat presentation with one unified Developer-only Jivan console.
- Added Developer console modes: Converse, Architect, Agents, Comms, Engineering and Activity; modes switch inside the same container.
- Added reactive procedural holographic visualization for idle, listening, analyzing, routing, executing, synthesizing, speaking, complete and error states.
- Added live execution-stage progress, route/task labels, specialist count, connector count, policy version and System Health telemetry.
- Moved Developer conversation scrolling inside the holographic console and suppressed the separate generic work HUD while Developer Jivan is active.
- Added Developer channel labels and a concise original mission-control response presentation in the Recovery Agent Edge Function.
- Preserved Jivan's existing human voice, continuous voice mode, Agent Builder, specialist agents, communications, engineering, Recovery Assurance, HR, governance and scalability controls.
- Ordinary users retain the existing simplified Jivan interface.
- No new SQL migration is required beyond the existing v6.2 Jivan Studio schema.



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


## v6.3.4
- Compacted the Developer Jivan holographic console, tabs, controls, telemetry, composer and Studio modules.
- Added desktop Developer Jivan no-page-scroll layout while retaining internal conversation scrolling.
- Increased spoken-response coverage from the previous short cap to long-response playback.
- Added smaller speech chunks, speech-engine resume heartbeat and transient chunk retry so Jivan continues speaking through long responses.
