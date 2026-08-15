# Assurance Regent v6.3.18 — Supabase Persistence Diagnostic

## Confirmed live
- Browser health RPC returns healthy/ready for state, voice, Jivan Studio, Recovery Assurance, governance, recruitment and scalability modules.
- Permanent Developer sign-in succeeds against Supabase.
- Transactional rollback test confirmed browser state write/readback, profile write RPC, and Jivan communication-log write.
- The saved Developer profile override in Supabase contains the configured email and profile-photo data.

## Static application audit
- 604 unique DOM IDs; no duplicate IDs found.
- 453 form/control elements: 154 inputs, 18 textareas, 55 selects, 199 buttons and 27 forms.
- No ID-addressed button was found without a JavaScript reference.
- JavaScript syntax check passes for app.js, careers.js and interview.js.

## Persistence gaps fixed in this patch
1. Work Activity supporting documents no longer silently discard file bodies above 600 KB. Accepted files up to 8 MB are stored completely in the Supabase-backed state; larger files are rejected instead of being partially saved.
2. Profile-photo input now accepts browser-supported image MIME types instead of restricting the UI to PNG/JPEG/WEBP/GIF. Display images are still normalized to JPEG for compatibility.
3. Jivan external communication logging now preserves the complete message body (up to 12,000 characters) in Supabase log metadata in addition to the short body excerpt.

## Architectural limits
- Control Center file bodies are currently persisted inside the Supabase JSON application state rather than a dedicated Storage object. This is durable for the current 8 MB limit but is not the preferred design for large-scale binary storage.
- Recruitment CVs and attachments already use a private Supabase Storage bucket and metadata tables.
- Public recruitment deliberately blocks executable/active-content file types. Arbitrary executable uploads should remain blocked for security.
- This audit verifies persistence paths and static control wiring. It is not a claim that every possible browser interaction, third-party provider, network condition, or role combination can never fail.
