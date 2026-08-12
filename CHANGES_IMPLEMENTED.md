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
