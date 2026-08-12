## Recovery Agent v5.1.0

This package includes the synchronized Recovery Agent page/floating operator, voice/microphone usability fixes, and Assurance Regent browser identity corrections.

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
