ASSURANCE REGENT v6.3.11 — ZARI ↔ JIVAN CONNECTED AGENTS

Zari is the reception/authentication agent at sign-in and sign-up. Jivan remains the primary internal Assurance Regent operator after authentication. Zari and Jivan share the same governed AI backend and role-scoped context.

Voice instruction capture now listens until speech ends instead of using a fixed five-second window. The browser uses speech/silence detection with a 55-second safety maximum for access instructions.

No new database migration is required beyond the corrected v6.3.9 HOTFIX 1 schema. Redeploy both Supabase Edge Functions from this package and deploy /public.
