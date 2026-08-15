# Assurance Regent Recovery Agent v5.5.0 — Developer Governance

Recovery Agent v5.5 adds first-class Developer-only governance actions on top of the v5.4 account/company controls.

## What Developer AI can now do

- Open **Notifications** and approve or reject an exact pending account.
- Open **Settings** and suspend or reactivate an exact account.
- Open **Settings** and assign an existing account as Employee, Administrator, or Developer.
- Open **Settings → Company Directory** and switch an exact company service ON or OFF.
- Update an exact company's monthly amount, billing currency, payment account/instructions, and billing message.
- Delete an exact non-permanent account after an explicit instruction and final browser confirmation.
- Continue using the existing guarded form-filling and button-clicking layer for other visible Settings controls.

## Guardrails

- These tools are only exposed to a signed-in **Developer**. Administrator and Employee AI never receive them.
- Account IDs and company IDs come from the Developer's live, server-scoped Assurance Regent context. The model cannot invent an arbitrary target outside that list.
- Approve/reject actions visibly open **Notifications** first.
- Suspension/reactivation, role assignment, company service/billing and deletion visibly open **Settings** first.
- Company OFF, account suspension/rejection, Developer-role elevation and deletion remain high-impact. The browser asks for confirmation before completing the most consequential action.
- The permanent `Dvp` Developer cannot be deleted, rejected, suspended, or demoted.
- Password values are not exposed in AI context. Password reset remains a visible Developer Settings control instead of an autonomous AI tool.
- Successful governance actions are appended to the existing Recovery Agent audit log.

## Example instructions

- `Recovery, open notifications and confirm John Banda's pending account.`
- `Recovery, reject the pending account for Peter Mwansa.`
- `Recovery, open settings and suspend Mary Phiri's account.`
- `Recovery, reactivate Mary Phiri.`
- `Recovery, make John Banda a Developer.`
- `Recovery, switch ABC Limited offline.`
- `Recovery, set ABC Limited monthly charge to ZMW 8,500 and use payment account 123456789.`
- `Recovery, switch ABC Limited back online.`
- `Recovery, delete the old account for TEMP-001.`

If two accounts or companies have ambiguous names, the Agent should ask the Developer to clarify instead of guessing.
