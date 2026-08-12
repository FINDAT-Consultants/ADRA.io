# Assurance Regent v4.6.0 — Supabase Connection Reliability Update

- Retains the existing Assurance Regent UI and current logo.
- Keeps normal production use independent of the retired Express/Netlify application server.
- Persists account and operational state to Supabase through protected PostgreSQL RPC functions.
- Restores active sessions after page refresh using browser session storage for the temporary token only.
- Adds `assurance_regent_browser_health()` so the frontend can identify missing SQL setup immediately.
- Preserves company ownership on all primary live-data record types and MTS evidence.
- Keeps the browser-safe publishable key only; no Supabase secret key is shipped.
- Continues to hide server-only Recovery Agent / OpenAI controls.
