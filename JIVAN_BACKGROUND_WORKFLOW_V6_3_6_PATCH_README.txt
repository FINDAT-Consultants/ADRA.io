Assurance Regent / Jivan v6.3.6 background workflow patch

Changes
- Removed the floating Jivan background-task count / zero button.
- Kept Background tasks in the main Jivan console.
- Developer Background view is now fully opaque and uses a dedicated workspace; chat/composer content is hidden while that view is open.
- Background task instruction/result descriptions were replaced by connected workflow nodes.
- Workflow nodes expose delegation, analysis, execution/tool actions, verification and final state.
- Completed task metadata is used to show actual tool-action stages where available.
- Background button receives an active/pressed state while the workflow workspace is open.
- Production public assets were re-hashed and SRI values refreshed.
