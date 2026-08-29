# Assurance Regent v6.3.0 — Holographic Console Security

The holographic console is a Developer presentation/runtime layer. It does not expand database authority or bypass existing role, RLS, Recovery Assurance, governance or human-approval boundaries.

## Controls preserved

- Developer authority is resolved through the existing authenticated control/session model.
- Agent Builder policies remain versioned in the v6.2 Studio schema.
- Communications retain explicit send intent, provider-side credentials in Edge Function Secrets and browser confirmation where configured.
- Human financial approvals, journal authorization, donor restrictions and destructive governance remain guarded.
- Jivan still cannot rewrite production code, SQL or RLS autonomously.
- Developer specialist agents inherit Jivan's allowed tool boundary; they do not create new privileges.

## Visual telemetry

The holographic progress display is intentionally a client execution-stage visualization only. It must not be interpreted as hidden model reasoning, a calibrated confidence score, or proof that a remote action succeeded. Real success/failure is taken only from actual tool/API results.

## Role isolation

Holographic/Studio presentation is gated both by runtime Developer checks and the `.developer-access` CSS class. Non-Developers retain the ordinary interface and do not receive Developer Studio controls.

## External secrets

No provider secret or OpenAI key is stored in frontend source. Existing Supabase Edge Function secret handling remains unchanged.
