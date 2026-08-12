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
