# Assurance Regent v6.1.0 — Scalability & Jivan Recovery Security

## Principles

Scalability controls must not become privilege-escalation controls. v6.1 therefore separates **diagnosis/recovery** from **business authority**.

## Access

- System Health UI/RPC: Developer, CEO, Administrator.
- Requeue stale Jivan tasks: Developer, CEO, Administrator within permitted scope.
- Purge expired sessions/rate buckets: Developer only.
- Incident tables and rate-limit tables are not directly exposed to anon/authenticated roles; access is through session-validating security-definer RPCs.

## Jivan boundaries

Jivan can detect and explain reliability problems and perform only the explicit safe recovery actions exposed by its tool schema. It cannot self-modify application code or database policy, alter roles, delete business data, change financial/HR records, override donor rules, or approve/post accounting transactions as a recovery action.

## Failure handling

Safe reads may retry transient failures. Writes are not automatically replayed because replaying a non-idempotent mutation can duplicate or corrupt business actions. Client incidents are throttled/deduplicated to avoid an outage generating a second outage through logging volume.

## Rate limiting

Jivan calls consume authenticated per-user buckets. The Edge Function returns 429 when the budget is exhausted. This protects shared OpenAI/Supabase capacity and limits accidental or scripted request floods without weakening account authorization.

## Multi-tab worker lease

The local browser lease is a traffic optimization, not a security boundary. Server-side task claim RPCs and role checks remain authoritative. If browser storage is unavailable, server authorization still protects tasks; the consequence is only reduced client-side deduplication efficiency.

## External outages

Jivan cannot guarantee self-healing if Supabase, OpenAI, the user's ISP, DNS or the browser itself is unavailable. In those cases it may display cached/local diagnostics when possible and should report the deployment/operator action required once connectivity exists.
