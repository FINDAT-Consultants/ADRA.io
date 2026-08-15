Assurance Regent v6.1.0 Scalability & Resilience Patch
======================================================
Apply this patch only to a complete v6.0.0 installation.

Required:
1. Run SCALABILITY_RESILIENCE_V6_1_0.sql in Supabase.
2. Run SCALABILITY_RESILIENCE_V6_1_0_VERIFY.sql.
3. Deploy RECOVERY_AGENT_EDGE_FUNCTION.ts as the existing recovery-agent Edge Function.
4. Overlay the frontend/public files and deploy Netlify.

No v6.0 Recovery Assurance feature is removed. See the deployment guide for the
new request pool, caching/coalescing, multi-tab worker leadership, rate limiting,
System Health and Jivan safe-recovery boundaries.
