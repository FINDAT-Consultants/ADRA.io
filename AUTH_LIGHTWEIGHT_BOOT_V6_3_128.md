# Assurance Regent v6.3.128 lightweight authentication boot

The public signed-out page must not execute the full Assurance Regent business runtime.

- `auth-entry-bootstrap.js` owns only login, registration, stored-session validation, and activation of the authenticated runtime.
- Body business scripts are emitted with `type="application/x-assurance-regent-runtime"` and therefore remain inert while signed out.
- A valid session is checked with `assurance_regent_browser_session_status` before those scripts are activated.
- The production-page browser smoke test must prove the login controls are browser hit targets, the renderer heartbeat remains alive, and the full runtime stays dormant while signed out.
