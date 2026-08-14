# Assurance Regent v6.1.0 — Scalability & Resilience Architecture

## Objective

v6.1 adds a bounded traffic and recovery layer without replacing the v6.0 business architecture. The design reduces request amplification, protects expensive AI operations, improves query paths, and exposes a controlled health plane to Jivan and senior system operators.

## Client traffic plane

The browser uses a **six-request concurrency pool**. Safe read RPCs can be coalesced when identical calls are already in flight and use short TTL caches for rapidly repeated views. Network requests have explicit timeouts; only safe reads receive bounded transient retries with jittered backoff. Mutations are not blindly retried.

The legacy application-state writer uses **latest-state coalescing** rather than a long promise chain: rapid edits replace the pending snapshot, one write runs at a time, and the newest pending snapshot is flushed next.

## Multi-tab leadership

Every browser tab receives a unique tab ID. A short localStorage lease elects one tab as the signed-in account worker leader. Only the leader performs Jivan background-task claiming and automatic resilience polling. If the leader closes, another open tab can acquire the expired lease. This prevents one user with many tabs from multiplying queue workers and health polling.

## Server traffic plane

`assurance_regent_rate_limit_buckets` implements authenticated, per-user, per-scope fixed-window throttling. Jivan uses a role-aware request budget. The Edge Function returns HTTP 429 rather than allowing uncontrolled bursts.

Hot-path indexes target authentication, credentials, Jivan messages/tasks/audit, leave/work status and Recovery Assurance records.

## Health plane

`assurance_regent_browser_scalability_health` returns a deliberately small snapshot:

- active sessions;
- queued/running/stale Jivan tasks;
- open/high incidents;
- recent Jivan/API errors;
- size of the legacy shared application-state payload;
- bounded safe recovery recommendations.

The client records deduplicated incidents in `assurance_regent_system_incidents` rather than exposing direct table writes.

## Recovery plane

Safe recovery is intentionally narrow:

- `REQUEUE_STALE_TASKS` — turns abandoned Jivan RUNNING tasks back into QUEUED;
- `PURGE_EXPIRED_SESSIONS` — Developer only;
- `PURGE_EXPIRED_RATE_BUCKETS` — Developer only.

No recovery operation mutates HR decisions, payroll, donor rules, Recovery Passport evidence, approvals, journal data, user roles or RLS/security policy.

## Caching

Netlify serves content-addressed/hash-named JavaScript, CSS and static assets with long immutable caching. `index.html` revalidates so a new deployment can reference new hashes immediately.

## Remaining structural ceiling

The oldest operational modules still synchronize through the historical `browser-client-state` JSONB row. v6.1 reduces how often that row is written and monitors its size, but it does not claim that one shared document is an infinitely scalable database model.

For the next scale tier, migrate remaining high-write collections—employees/project masters where appropriate, payroll masters, calendars and legacy time collections—into normalized company-scoped tables with server-side cursor pagination and optimistic versioning. This can be done incrementally because Jivan, leave/work status and Recovery Assurance are already table-backed.
