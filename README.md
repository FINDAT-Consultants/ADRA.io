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
