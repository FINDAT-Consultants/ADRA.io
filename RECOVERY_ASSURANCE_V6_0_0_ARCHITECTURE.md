# Assurance Regent v6.0 — Recovery Assurance & Accounting Architecture

## Recovery evidence spine

`Work Activity / time evidence → human time approval → payroll reconciliation → donor/project rules → five-key Recovery Passport → immutable snapshot → human assurance → journal draft/export → audit trail`

The live engine remains useful for operational calculation and exception resolution. The normalized Supabase layer preserves the financial evidence that supports a proposed charge.

## Five-key Recovery Passport

Every employee × project × reporting-month charge evaluates:

1. **Evidence** — approved work exists and any configured supporting-document requirement is met.
2. **Capacity** — approved/recorded monthly activity reconciles to expected hours.
3. **Eligibility** — project/date/employee eligibility and applicable administration restrictions pass.
4. **Budget** — project personnel budget and configured donor ceilings/currency controls pass.
5. **Approval** — the required monthly human time-approval chain is complete.

All five PASS => Recovery Gate 1 / RECOVERABLE.
Any failure => Recovery Gate 0 / BLOCKED, proposed cost retained, recoverable cost zero, remediation generated.

## Management by exception

Recovery Exceptions gives Supervisor, Head of Department, Project Manager and Programs Manager a deliberately limited view of blocked items within managed scope. It exposes hours, failed controls, reason, responsible owner and corrective action while hiding payroll rates, salary/cost formulas, immutable finance records and journal data.

## Finance workspace

Recovery Assurance provides:
- employee/project Passport register
- five-key reasoning
- counterfactual recovery advice
- evidence-to-charge trace
- supporting-evidence links
- donor-rule versions
- immutable Passport versions and hashes
- human Supervisor/Finance Assurance history
- controlled journal drafts and CSV exports

## Recovery-risk forecasting

The Dashboard combines current blocked proposed cost with incomplete expected-time exposure to show a projected month-end risk indicator. This is management forecasting only; it never authorizes accounting.

## Audit Centre

The deterministic control suite checks duplicate evidence, time-entry bounds, eligibility, approvals, payroll configuration, source reconciliation, five-key blocks, evidence rules, project budget, snapshot hashes, segregation-of-duties conflicts and journal balance. Runs create append-only Recovery Audit events.

## Jivan

Jivan is an operator and recovery assistant, not an accounting authority. Jivan may explain, navigate, create explicitly requested immutable snapshots, create explicitly requested journal drafts after human Finance Assurance, and run audit tests. Human approval and journal authorization stay outside Jivan tools.


## Independent audit role
The v6 authority model includes `Auditor / Internal Audit` as a read-only assurance role. It sees Recovery Exceptions, Recovery Assurance and Audit Centre outputs without receiving Finance write powers. This separates independent testing from operational finance authorization.
