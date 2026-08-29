Assurance Regent v6.3.3 — Jivan Hologram Performance & Header Cleanup

Changes
1. Developer hologram is static while idle. Animation starts only for active listening/processing/execution/speaking/error states.
2. Expensive blur/backdrop-filter and animated box-shadow effects are removed or reduced in performance mode.
3. Hologram rendering pauses when the browser tab is hidden.
4. Switching from Converse to Architect/Agents/Comms/Engineering/Activity hides the hologram overlay instead of rendering it behind the active module.
5. Repeated hologram telemetry/state DOM writes are deduplicated.
6. The text underneath DEVELOPER INTELLIGENCE CHANNEL is removed in Developer mode.
7. Jivan voice, natural responses, tools, specialist agents, communications, Recovery Assurance, System Health and security controls are unchanged.

Deployment
No SQL migration is required. No Edge Function replacement is required. Deploy the frontend and hard-refresh the HTTPS site.
