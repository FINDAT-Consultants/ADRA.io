# Assurance Regent v4.6.0 — Supabase Connection Reliability Update

- Retains the existing Assurance Regent UI and current logo.
- Keeps normal production use independent of the retired Express/Netlify application server.
- Persists account and operational state to Supabase through protected PostgreSQL RPC functions.
- Restores active sessions after page refresh using browser session storage for the temporary token only.
- Adds `assurance_regent_browser_health()` so the frontend can identify missing SQL setup immediately.
- Preserves company ownership on all primary live-data record types and MTS evidence.
- Keeps the browser-safe publishable key only; no Supabase secret key is shipped.
- Continues to hide server-only Recovery Agent / OpenAI controls.


## v4.7.0 Recovery Agent
- Restored Recovery Agent chat through Supabase Edge Functions and the OpenAI Responses API.
- Added per-user Supabase conversation history.
- Added server-side validation of the existing Assurance Regent session token before any OpenAI request.
- Kept the OpenAI API key out of browser JavaScript and Git.
- Made Recovery Agent visible in navigation.
- v4.7.0 is advisory/read-only: it analyzes current Supabase data but does not execute record-changing AI tools.
