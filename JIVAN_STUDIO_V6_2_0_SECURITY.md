# Assurance Regent v6.2.0 — Jivan Studio Security Model

## Developer-only control plane
Only an authenticated Assurance Regent Developer can read/save Studio versions or read the external communications audit history. Direct table privileges are revoked and RLS remains enabled.

## Immutable policy guardrails
The save RPC enforces server-side safety keys even when a caller bypasses the normal UI:
- explicit external-send confirmation cannot be disabled;
- autonomous production-code changes cannot be enabled;
- autonomous security/RLS changes cannot be enabled.

Developer-added prompt rules are explicitly subordinate to built-in tenant, role, privacy, HR, financial, Recovery Assurance and destructive-action boundaries.

## Specialist agents
Specialist agents are advisory only. They receive bounded role-scoped context and cannot use tools, send communications, approve records or increase user authority. Jivan remains the only user-facing orchestrator.

## External communications
Provider credentials remain in Supabase Edge Function Secrets and are never returned by `studio_status`; the client receives only configured/not-configured flags. External sending/calling is Developer-only and requires connector enablement plus final confirmation. Communications are rate-limited and audited.

WhatsApp requires appropriate recipient consent/opt-in and provider/template compliance. The browser confirmation explicitly reminds the Developer of that responsibility.

## Calls
The voice connector creates an outbound provider call that speaks a supplied message. It does not silently record the called party and it is not a general two-way telephone agent in v6.2.

## Maintenance
Jivan Studio does not grant self-modifying production authority. Engineering controls are restricted to diagnostics, cache refresh, System Health, and previously defined safe recovery actions such as requeueing stale tasks. Data deletion, authority changes, code changes, SQL/RLS changes, financial approvals and journal authorization remain outside automatic maintenance.

## Auditability
Studio saves create new version rows with hashes, creator and activation timestamps. External communication attempts record channel, recipient, provider, status, provider reference and a bounded body excerpt; secrets are not stored in the log.
