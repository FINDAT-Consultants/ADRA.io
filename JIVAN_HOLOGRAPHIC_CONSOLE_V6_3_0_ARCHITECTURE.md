# Assurance Regent v6.3.0 — Developer Holographic Console Architecture

## Role split

The Developer Jivan view and the ordinary-user Jivan view share the same underlying AI, security boundaries and data model, but use different presentation layers. `Developer` authority activates `body.developer-access`; every holographic override is role-gated by that class and runtime authority checks.

## One-container model

`#jivanMainConsole` is the sole Developer command container. It contains:

- the normal Jivan header and voice controls;
- `#developerConsoleNav` for in-place mode switching;
- `#developerHoloOverlay` for procedural live visualization;
- `#jivanConversationLayer` for the conversation and compose area;
- `#jivanDeveloperStudio` for Architect/Agents/Comms/Engineering/Activity modules.

Only one primary content layer is visible at a time. The Studio no longer renders as a separate card above the conversation.

## Holographic state machine

The client exposes `window.JivanHoloController` and maps observable runtime stages to display states:

`idle -> received -> listening/analyzing -> routing -> executing -> synthesizing -> speaking -> complete`

Errors move to `error`. Voice Conversation updates listening/speaking states directly. Browser-agent/tool events update routing and execution labels.

The percentage shown by the UI is a bounded execution-stage indicator derived from known client phases; it is not a model-confidence metric and does not expose hidden reasoning.

## Studio integration

The v6.2 persisted Agent Builder, specialist agents, communications connectors, engineering diagnostics and activity history are retained unchanged at the data layer. v6.3 only changes how these modules are surfaced and how the active Developer response presentation is instructed.

## Developer response presentation

The `recovery-agent` Edge Function adds a Developer-only presentation contract: concise, technical, calm and operational. Jivan may use useful headings such as STATUS, ANALYSIS, EXECUTION, RESULT, ATTENTION and NEXT when they improve clarity, but must not invent sensor data, fabricated progress or theatrical claims.

## Ordinary users

Non-Developer accounts do not receive `developer-access`, the command-mode navigation or the holographic Studio overlay. Their existing Jivan experience remains the simplified standard interface.
