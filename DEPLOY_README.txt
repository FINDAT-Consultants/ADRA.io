ASSURANCE REGENT HARDENED PRODUCTION DEPLOYMENT v5.3.0

This package contains production-only browser assets. It intentionally excludes readable source copies, SQL setup files, design documentation, and development data.

1. Use a PRIVATE GitHub repository.
2. Upload this package contents to the repository root.
3. Netlify publishes only /public.
4. Keep the separate Private Source package offline/private.
5. Do not add secret/service-role/OpenAI keys to this repository.

Anti-copy keyboard/right-click controls are deterrents only. The real security boundary is Supabase RLS + Edge Functions + server-side secrets.

After frontend deployment, separately deploy the provided hardened Recovery Agent Edge Function in Supabase and set ASSURANCE_ALLOWED_ORIGINS to your production URL.
