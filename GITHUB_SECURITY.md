# Repository and secret safety

The web files contain only browser-safe configuration. Keep all privileged credentials in Supabase-managed secrets.

- Put `OPENAI_API_KEY` only in **Supabase Edge Function Secrets**.
- Never commit Supabase secret/service-role keys.
- `public/supabase-config.js` may contain only the Project URL and Publishable/anon key.
- The `.arc` packaging is an interface-obfuscation deterrent, not a cryptographic security boundary.
- Database tables are protected by RLS with no anonymous table policies; privileged access is performed by the hosted Edge Function after application authorization checks.
