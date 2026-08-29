# Assurance Regent v6.3.19 — Selective ADRA Feature Merge

## Base contract

This build uses **Assurance Regent v6.3.19 Full Supabase Persistence Fixed** as the authoritative base. The original sign-in/sign-up contract and original Zari/Jivan/Recovery Agent voice behavior are protected.

Protected from the v6.3.19 base:

- Sign-in and sign-up dialog markup and controls.
- Password sign-in and governed Supabase browser-session flow.
- Registration and voice-enrollment flow, including the default enabled Voice sign-in checkbox.
- Zari authentication prompts, voice recognition/enrollment phrases, auth voice capture, and Zari-to-Jivan handoff behavior.
- `recovery-agent-v5.js` and its production public artifact.
- `JIVAN_V5_12_0_VOICE_CONVERSATION_GUIDE.txt`.
- Base recruitment-public email behavior (the later ADRA forced-Resend replacement was not imported).

## Selectively included ADRA capabilities

Only later capabilities not already present in the v6.3.19 base were layered in. Major included groups are:

- Role-scoped access controls and dashboard analytics.
- Management/internal inbox, threaded operational messaging, Jivan drafting, and pane isolation.
- Settings modal, data controls, personal Storage Library, password/security controls, and company controls.
- Department Hub social feed, reactions, statuses, stories/trending, department directory, media/file attachments, and retention/reporting support.
- Company social/profile enhancements and Developer company administration.
- Reporting/audit/retention extensions.
- Work Activity job continuity, resume/progress handling, approved-work/recovery linkage, payroll progress, and work-status controls.
- Gmail OAuth connector, Google Meet interview assistant, and Developer API connection controls.
- Operational UI and single-page company creation enhancements.
- Budget donor import, personnel directory, budget approvals, recovery voucher/live recovery, exception handling, and automation-first work controls.
- Recruitment selections/onboarding transfer while preserving human final decision control.
- Company country/holiday support, global country flags, searchable linked-PNG country selectors, interface stabilization, and Work Analytics layout refinements.
- Additive owner-scoped file deletion modes in the Assurance Regent file Edge Function for the personal Storage Library.

## Deliberately excluded ADRA replacements

The following later ADRA layers were excluded because they replace or materially alter the protected v6.3.19 auth/voice contract:

- v6.3.127/v6.3.128 lightweight auth bootstrap and auth-entry replacement assets.
- v6.3.98 and v6.3.100–v6.3.104 shared voice/microphone rewrites.
- `supabase/functions/jivan-voice/index.ts` and the later server-synthesized auth handoff.
- The ADRA `recruitment-public` change that removes the existing mail-client fallback and requires Resend for recruitment email delivery.
- ADRA GitHub workflows that auto-write/publish generated artifacts to `main`; the final runtime is self-contained instead.

## Production safeguards applied

- The original v6.3.19 sign-in/register dialog region is retained exactly in root and production `public/index.html`.
- Protected auth/voice functions and voice enrollment phrases were checked against the original v6.3.19 source.
- The Recovery Agent runtime and voice conversation guide retain their original v6.3.19 hashes.
- The v6.3.124 country-selector MutationObserver was made idempotent to prevent a DOM mutation feedback loop with v6.3.125.
- Netlify CSP was extended only where required for Supabase private media and flag image providers.
- All production local assets exist and all 11 SRI (`sha384`) bindings in `public/index.html` were recalculated and verified.
- Production app/style cache versions were refreshed after the selective merge.

## Supabase deployment requirement

The ZIP contains the ADRA SQL migration/support files and additional Edge Functions required by the included database-backed features. **They are packaged but have not been applied to any live Supabase project by this merge operation.** Deploy the required SQL migrations/functions to the intended Supabase project before expecting newly added RPC-backed modules (Department Hub, storage library, budgeting, recruitment selections, country/holiday features, connectors, etc.) to be live.

The existing v6.3.19 authentication configuration and project URL/key wiring were not replaced.

## Verification status

- Main root and production app JavaScript syntax: passed.
- Base auth/sign-up/sign-in contract comparison: passed.
- Voice enrollment/auth vocabulary comparison: passed.
- Sign in → Sign up → Sign in Chromium interaction smoke: passed.
- Voice sign-in checkbox default: passed (enabled, matching v6.3.19).
- Production local asset resolution: passed.
- Production SRI validation: passed (11/11).
- Major feature verifiers for RBAC, dashboard, settings/storage, company controls, Department Hub media, reporting, Work Activity, Gmail, Meet, API connections, budgeting/recovery, automation, leave/work status, recruitment selections, country/holiday support, and interface stability: passed.

Some original ADRA patch verifiers for v6.3.120–v6.3.122 are intentionally obsolete in this selective build because their artifacts were superseded by v6.3.124 and their expected auto-publishing workflow was removed. A management-inbox verifier also expects a later Recovery Agent overlap modification that was deliberately not imported so the v6.3.19 Recovery Agent remains exact.

## v6.3.129 Developer registered-country correction

The Company Profile editor now explicitly permits the **Developer** authority to change an existing registered country. The selector remains a single searchable country control; changing the country requires confirmation, persists `registeredCountry`/`registeredCountryCode` plus compatibility `country`/`countryCode`, records the before/after values in `registrationHistory`, and refreshes the company holiday context. Administrator and Employee permissions are unchanged.

For an existing Supabase project, apply `supabase/migrations/20260824213000_developer_registration_country_change_v6_3_129.sql`. The consolidated setup/repair SQL files in this package were also updated so fresh deployments no longer enforce the former immutable-country guard.
