# Assurance Regent v6.0 — Recovery Assurance Security Model

## Objective

v6 separates operational calculations from financial evidence. A live Recovery Passport can be recalculated, but an assurance snapshot is stored as a **new immutable version** with its five key results, source-state hash, payload hash, human decisions, supporting-evidence references and accounting handoff events.

## Authority boundaries

- **Employee:** no financial Recovery Assurance workspace.
- **Supervisor / HOD / Project / Programs:** management-by-exception for managed scope; no payroll-rate or journal exposure in Recovery Exceptions.
- **Finance Manager:** company financial assurance, donor rules, immutable Passport archive, journals and audit.
- **Administrator / CEO:** company-scoped authority subject to guarded RPCs.
- **Developer:** system-wide technical/governance authority; financial actions remain audited.

RLS is enabled on all v6 financial tables. Browser roles do not receive direct table grants. Browser operations go through session-validated security-definer RPC functions.

## Immutable evidence

Updates/deletes are rejected for:
- Recovery Passport snapshots
- Passport key results
- human assurance events
- supporting-evidence links

Corrections create a new Passport version or a downstream controlled reversal rather than rewriting history.

## Five-key server control

The server recomputes Evidence, Capacity, Eligibility, Budget and Approval from the supplied Passport payload before storing a snapshot. A failed key forces Recovery Gate = 0 and recoverable cost = 0 while retaining the raw/proposed cost and amount at risk.

## Human assurance

Supervisor and Finance Assurance are append-only human events with actor, authority, timestamp, decision and note. Rejections require a reason. Manager-level supervisor assurance is additionally restricted to the actor's managed employee scope.

Jivan has no tool that records these human financial decisions.

## Journal control

A journal draft can be created only when:
1. the immutable Passport status is RECOVERABLE;
2. Recovery Gate = 1;
3. recoverable amount is positive; and
4. the latest Finance Assurance decision is APPROVE.

Journal creation produces balanced debit/credit lines. Jivan may request a DRAFT on explicit user instruction, but cannot approve or post it. Human UI controls handle journal approval/export. Exported journals cannot be cancelled inside Assurance Regent.

## External systems

v6 does not embed external accounting credentials and does not silently post to third-party ledgers. A future accounting connector should use server-side credentials, explicit company configuration, idempotency keys, chart-of-accounts mapping, reversal/error handling, least privilege and complete audit events.


## Independent Auditor authority
`Auditor / Internal Audit` is a senior read-only recovery-assurance authority. It may review immutable evidence and run audit tests, but cannot create or alter donor rules, evidence links, Passport snapshots, human assurance decisions, or journal workflow states. Assignment is limited to CEO or Developer; Administrators cannot assign or override this authority.

Auditors may download a read-only CSV copy of approved journal lines for testing. This does not transition the controlled journal to `EXPORTED`; only Finance/Administrator/CEO/Developer authority can perform the operational export-status change.
