# v4.5.0 changes

- Removed Netlify Functions and the Node/Express runtime from the deployed application.
- Removed the “The Assurance Regent server API is not deployed…” warning path.
- Removed server-only Recovery Agent / adaptive model UI from the direct-Supabase edition.
- Added direct Supabase RPC authentication and persistence.
- Preserved permanent Developer login: Dvp / Abcd@1234.
- No localStorage, sessionStorage or IndexedDB persistence.
- Supabase publishable key is used in the browser; no secret/service-role key is embedded.
- Netlify now publishes `public/` as a static site from GitHub.
