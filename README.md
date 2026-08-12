# Assurance Regent v4.5.0 — Direct Supabase Edition

This edition is a static Netlify site. It does **not** use Netlify Functions or a separate Node/Express application server.

Durable Assurance Regent application data is saved to Supabase through restricted PostgreSQL RPC functions using the browser-safe Supabase publishable key. No Supabase secret key is embedded in the website.

## Required one-time Supabase step
Run `supabase/ASSURANCE_REGENT_DIRECT_BROWSER_MODE.sql` in the Supabase SQL Editor.

## GitHub → Netlify
Commit this project to the GitHub branch already connected to Netlify. Netlify publishes the `public` directory directly. There is no `netlify/functions` directory in this edition.

## Developer login
- User type: Developers - Only
- Username: Dvp
- Password: Abcd@1234

The Developer credential is verified inside a Supabase PostgreSQL RPC, not by a Netlify server.

## Intentionally removed
The Recovery Agent / server-side OpenAI execution and other controls that required a separate application server are not included in this direct-Supabase edition. Core account, company, workforce, work evidence, recruiting, onboarding, time, payroll, calendar, project and recovery functions remain in the static application.
