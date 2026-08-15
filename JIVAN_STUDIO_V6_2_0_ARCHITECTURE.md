# Assurance Regent v6.2.0 — Developer Jivan Studio Architecture

## Purpose
Jivan Studio is a Developer-only control plane layered on the existing v6.1 application. It does not replace Jivan, Recovery Assurance, HR, departmental governance, scalability, voice or background work.

## Runtime flow

`Developer UI → versioned Studio RPC → active policy → recovery-agent Edge Function → optional specialist consultation → Jivan main reasoning → guarded UI/provider action`

The active Studio policy is retrieved server-side for each Jivan request. A Developer can apply a policy only to Developer Jivan and the v6.2 runtime is Developer-only. Built-in authority and security rules remain authoritative.

## Agent Builder
The policy stores bounded preferences such as reasoning profile, autonomy profile, maximum client tool steps, specialist routing, background delegation, automatic diagnostics and additional instructions. A new Save creates a new immutable policy version; activation archives the previous active version.

## Specialist agents
Specialists are advisory reasoning calls made before Jivan's main response when routing matches a configured domain. They receive the same role-scoped context and explicit hard boundaries. Their findings are inserted as advisory context for Jivan; they cannot call tools or authorize actions themselves.

Default specialists include Systems Engineering, Communications, Recovery & Finance, People & HR, Research & Analytics, and Projects & Programs. Developers can add/edit/remove specialists in the Studio policy.

## Communications
Outbound providers remain server-side:
- Email: Resend
- WhatsApp: Twilio Programmable Messaging / WhatsApp sender
- Voice: Twilio Calls API with TwiML speech

The browser stores only enabled flags and public sender identities. Provider API credentials remain Edge Function secrets. Every actual outbound action is Developer-only, requires an explicit current Jivan instruction and then a browser confirmation. Communication results are appended to the Studio communication log.

## Engineering
The Studio engineering panel composes existing v6.1 System Health and safe-recovery primitives with Edge/connector diagnostics. It may requeue stale background work and refresh client caches. Code/RLS/security rewrites remain deployment actions outside autonomous Jivan repair.

## Holographic visualization
The hologram is an original CSS/DOM telemetry visualization shown only to Developer users. It is decorative/operational status presentation; it does not create a separate authority channel.

## Scalability
Studio metadata is small, versioned and fetched with a short read cache. Specialist calls occur only when a configured routing domain matches. External communications have a dedicated rate-limit scope in addition to normal Jivan traffic protection.
