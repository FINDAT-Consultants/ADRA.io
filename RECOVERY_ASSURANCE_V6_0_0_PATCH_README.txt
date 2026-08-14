Assurance Regent v6.0.0 — Recovery Assurance & Accounting Patch

BASELINE
Apply this patch to Assurance Regent v5.13.0 or deploy the v6.0.0 complete package instead.

REQUIRED DATABASE UPGRADE
1. Ensure prior v5.9 background-task and v5.10 departmental-authority migrations are already installed.
2. Run RECOVERY_ASSURANCE_V6_0_0.sql in Supabase SQL Editor.
3. Run RECOVERY_ASSURANCE_V6_0_0_VERIFY.sql and confirm ready=true and all control flags are true.

EDGE FUNCTION
Replace/deploy the existing recovery-agent function from:
  supabase/functions/recovery-agent/index.ts
Keep OPENAI_API_KEY only in Supabase Edge Function Secrets.

FRONTEND
Overlay the patch files on the v5.13 project, then deploy to the normal HTTPS Netlify site.
The public directory contains the production hashed/SRI build.

IMPORTANT FINANCIAL CONTROL BOUNDARY
Jivan may explain exceptions, run deterministic audits, create explicitly requested immutable Passport snapshots and prepare a journal DRAFT only after server-confirmed human Finance Assurance. Jivan cannot approve/reject Finance Assurance, change approved hours, override donor rules, authorize/post a journal, or impersonate a reviewer.

ACCOUNTING INTEGRATION
v6 generates controlled balanced journal drafts and CSV exports. It does not directly post into an external accounting platform. A specific accounting-system connector/API is a separate integration.
