# Workbook Formula Mapping

The full catalog is machine-readable in `data/workbook_formula_catalog.json` and consumed by the backend recovery engine. It contains 52 source formula rules; the internal catalog is not exposed as a front-end screen.

## Time Entry

Representative workbook rules reproduced by the engine:

```text
Month
= DATE(YEAR(Work Date), MONTH(Work Date), 1)

Daily Total
= SUMIFS(finance-approved Hours, same employee, same work date)

Daily Check
= compare Daily Total with Calendar Standard Hours

Project Eligibility
= employee eligible + active project + work date inside project dates

AI Coding Check
= suggestion/project match + explicit employee acceptance

Entry Assurance
= valid positive hours (≤24 and quarter-hour precision)
  + Daily Check
  + Project Eligibility
  + AI Coding Check
```

## Payroll

```text
Allocable Employment Cost
= Basic Salary
+ Eligible Benefits
+ Employer Statutory Cost
− Recoverability Exclusions
```

## Calendar

```text
Recorded Approved Hours
= SUMIFS(finance-approved Time Entry hours by date)

Variance
= Recorded Approved Hours − Standard Hours

Daily Status
= PASS when expected/recorded reconciliation meets workbook rule;
  otherwise REVIEW
```

## Monthly Engine

```text
Expected Hours
= SUM(Calendar Standard Hours for month)

Recorded Hours
= SUM(finance-approved Time Entry hours for month)

Direct Project Hours
= SUM(finance-approved non-ADMIN hours)

Administration Hours
= SUM(finance-approved ADMIN hours)

Hours Variance
= Recorded Hours − Expected Hours

Allocable Employment Cost
= Payroll allocable cost for month

Employment Hourly Cost
= Allocable Employment Cost / Expected Hours

Direct Project Cost
= Direct Project Hours × Employment Hourly Cost

Administration Cost
= Administration Hours × Employment Hourly Cost

Unrecovered Cost
= Allocable Employment Cost − Direct Project Cost − Administration Cost
```

### Assurance components

```text
Completeness
= MIN(1, Recorded Hours / Expected Hours)

Daily Reconciliation
= proportion of working-day hours satisfying daily control

Eligibility
= proportion of finance-approved hours passing project eligibility

Timeliness
= 1 in the pilot workbook

Approval
= 1 only when the month contains no time entry below Finance approved status

Readiness
= 0.35×Completeness
+ 0.25×Daily Reconciliation
+ 0.15×Eligibility
+ 0.15×Timeliness
+ 0.10×Approval
```

### Posting status

```text
READY TO POST
when ABS(Hours Variance) < 0.01
AND Critical Exceptions = 0

otherwise BLOCKED
```

### Recovery rate

```text
Recovery Rate
= Direct Project Cost / Allocable Employment Cost
```

## Checks

The Checks sheet compares calculated monthly approved hours with the source control totals. The engine preserves the delta/pass-fail logic, overall model status, blocked-month count and payroll configuration status.

## Voucher

```text
Approved Project Hours
= SUMIFS(finance-approved Hours by selected month/project)

Raw Project Cost
= Approved Project Hours × Monthly Employment Hourly Cost

Recoverable Cost
= 0 when monthly posting status is BLOCKED
  otherwise MIN(Raw Project Cost, Available Personnel Budget)
```

## Recovery Passport extension

The application presents the workbook controls in a five-key digital passport:

```text
Recovery Gate
= EvidenceKey
× CapacityKey
× EligibilityKey
× BudgetKey
× ApprovalKey

Recoverable Cost
= Approved Project Hours
× Employment Hourly Cost
× Recovery Gate
```

This extension is implemented as a transparent control layer; it does not allow AI to override the workbook's posting status.
