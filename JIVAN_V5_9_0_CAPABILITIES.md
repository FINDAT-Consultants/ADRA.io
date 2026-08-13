# Jivan v5.9.0 — Named Agent & Delegated Work

Jivan is Assurance Regent's role-aware agentic AI operator. The name is recognized in ordinary typed and voice-transcribed requests, including “Jivan”, “Hey Jivan”, “Hi Jivan” and “Okay Jivan”.

## Foreground work

Jivan can continue the existing navigation, form population, governed clicks, profile/settings actions, account/company governance, leave/work-status operations, document analysis, public research, reports, exports and voice interaction. Multi-step execution limits are expanded by role, but the authorization and confirmation boundaries are retained.

## Delegated/background work

When the user explicitly asks Jivan to work “in the background”, “delegate this”, or “continue while I work elsewhere”, non-interactive work can be placed in a persistent Supabase task queue. The current implementation is designed for research, analysis, role-scoped exports, report/document preparation, research visualizations and review of stored/available documents.

The visible page is not navigated or manipulated by a background task. Task state is stored in Supabase and survives refresh. Processing runs while Assurance Regent is open and signed in; queued tasks resume when the application is reopened. A task interrupted after being claimed is automatically eligible for recovery after a short stale-worker timeout.

## Local files

Jivan can activate an upload control/file chooser and automatically continue the Assurance Regent upload/analyze workflow after a file is selected. Browsers intentionally do not allow a website to silently enumerate a private disk and choose an arbitrary local file without the user's selection or prior explicit access grant.

## Guardrails retained

Background delegation is not used for file-picker selection, sign-out, purchases, approvals/rejections, account or company suspension, Developer-role assignment, deletion or other actions that require foreground authorization/confirmation. Those operations remain role-scoped and auditable.
