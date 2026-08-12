# Assurance Regent v4.5.1 — Login & Direct Supabase Stability Fix

- Fixed the post-login `Cannot read properties of null (reading 'reset')` error by capturing form references before asynchronous Supabase calls.
- Fixed the same async form-reset risk in registration and document submission.
- Work Activity Hub now reads MTS sessions/messages directly from the Supabase-backed browser state instead of the removed `/api/mts/*` server endpoints.
- Control Center documents are stored in the Supabase-backed application state in Direct Supabase mode and can be opened without a Netlify Function.
- Preserved Control Center documents, reviews and notifications when rebuilding the signed-in profile.
- Location reverse-geocoding uses the public endpoint directly rather than the removed Assurance Regent app server.
- Added null-safe form resets throughout the live browser UI.
- Developer credentials remain Dvp / Abcd@1234.
- No Supabase SQL change is required if the v4.5.0 Direct Browser SQL has already been run.
