# Jivan v5.10.0 Authority Model

| Authority | Primary scope | Typical approvals / controls |
|---|---|---|
| Developer | Entire Assurance Regent system / all companies | Developer governance, company service, all company functions |
| CEO | Entire signed-in company | Overall company approvals, settings, cross-department oversight |
| Administrator | Signed-in company administration | Broad company operations, excluding Developer/CEO elevation |
| Human Resources Manager | HR / people | Leave decisions, leave policy, employees, recruiting, onboarding, HR documents |
| Finance Manager | Finance | Payroll, finance-stage time review, checks, vouchers, finance documents/cost reporting |
| Programs Manager / Director | Program portfolio | Programs/projects, managed teams, delivery evidence and program reviews |
| Project Manager | Project / managed team | Project work, managed-team time and project documents/reviews |
| Head of Department / Supervisor | Managed team | Team work/time/document review |
| Employee | Own/personal | Own work, time, leave, permitted documents and profile |

The system role (Developer / Administrator / Employee) is retained for compatibility. Functional authority is resolved from the assigned functional-authority field, job title and department. Developer remains the highest authority. Sensitive operations still require the existing explicit Jivan/UI guardrails.

## Administrator boundary

Administrators remain company-scoped system operators, but they cannot grant, demote, or override CEO or senior departmental-manager authority. Those hierarchy changes require the CEO or Developer, and CEO authority itself can only be assigned by a Developer.
