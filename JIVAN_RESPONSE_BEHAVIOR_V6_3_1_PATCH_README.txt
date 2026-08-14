Assurance Regent v6.3.1 — Jivan Natural Response Behavior Patch

PURPOSE
Restore Jivan's natural, task-focused response behavior while preserving the v6.3 holographic Developer console and all v6.2/v6.1/v6.0 functionality.

CHANGES
- Removed the forced Developer “status first” mission-control response cadence.
- Removed routine STATUS / ANALYSIS / EXECUTION / RESULT / NEXT headings from Jivan's built-in response policy.
- Jivan now follows the user's actual instruction first: perform permitted actions, answer questions directly, explain analysis naturally, and confirm outcomes concisely.
- Status/diagnostic formatting is reserved for explicit system-health, incident, audit, diagnostic or structured technical-briefing requests.
- Developer holographic execution states and percentages remain visual UI telemetry and no longer need to be repeated in Jivan's prose.
- Restored the calmer v6.2-style default Studio persona, with an explicit task-first instruction.
- Role and authorization boundaries are unchanged.
- Voice behavior is unchanged.
- No new SQL migration is required.

DEPLOYMENT
1. Deploy the v6.3.1 frontend files or complete ZIP.
2. Replace the Supabase recovery-agent Edge Function with the v6.3.1 function included in the package.
3. Hard-refresh the deployed HTTPS site.
