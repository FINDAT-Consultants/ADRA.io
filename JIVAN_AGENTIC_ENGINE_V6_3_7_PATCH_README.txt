Assurance Regent v6.3.7 — Developer-only Jivan Agentic Engine

Implemented:
- Sidebar Jivan is hidden and blocked for every authority except Developer.
- Direct navigation to the Jivan developer page is denied for non-developers even if an older allowedViews payload contains assistant.
- Removed the developer-page voice/mute, voice conversation, background-task toolbar, minimize, new conversation, clear conversation, upload and send controls.
- Removed the developer hologram/core overlay and the Studio hologram pane from the active UI.
- Replaced Converse with Structure. Jivan is the root orchestrator above enabled specialist agents.
- Each Jivan/agent node is clickable and expands a decision tree showing routing, authority/policy gating, execution and verification.
- Existing Architect, Agents, Comms, Engineering and Activity Studio modules remain available to Developer.
- Hologram runtime updates are reduced to lightweight engine-state text updates for compatibility with existing Jivan integrations.
