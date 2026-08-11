# White-page fix

This package fixes the blank/white startup page when the repository root is served as a static site such as GitHub Pages.

## Fixed

- Root `index.html` now loads the actual bootstrap script from `public/shield.js`.
- `public/shield.js` now resolves protected `.arc` assets relative to the script location, so repository subpaths such as `/repo-name/public/assets/...` work correctly.
- GitHub Pages/static-root mode now uses the application's browser preview path instead of trying to call unavailable Node/Express `/api/*` endpoints.
- Added `.nojekyll` for straightforward GitHub Pages static-file serving.
- Repacked the protected browser application after the startup-mode change.

## Important deployment distinction

GitHub Pages can display the browser preview, but it cannot run the Node/Express backend. For persistent server data, OpenAI agent execution, server authentication, and optional Supabase integration, deploy the project to a Node.js host and start it with `npm start`.

## GitHub Pages

Place the contents of this folder at the repository root, then configure GitHub Pages to publish that repository root. The root `index.html` is the static entry point.
