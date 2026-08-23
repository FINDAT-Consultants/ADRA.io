import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
const outPath = resolve(publicDir, 'auth-entry-production-smoke.html');
const html = readFileSync(indexPath, 'utf8');

function requireOne(pattern, label) {
  const match = html.match(pattern);
  if (!match) throw new Error(`Could not extract ${label} from public/index.html.`);
  return match[0];
}

const signIn = requireOne(/<dialog\b[^>]*\bid=["']controlSignInDialog["'][\s\S]*?<\/dialog>/iu, 'the real sign-in dialog');
const register = requireOne(/<dialog\b[^>]*\bid=["']controlRegisterDialog["'][\s\S]*?<\/dialog>/iu, 'the real sign-up dialog');
const styles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/giu)]
  .map((match) => match[0])
  .join('\n');
const bootstrap = requireOne(/<script\b[^>]*\bsrc=["']\.\/auth-entry-bootstrap\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu, 'the authentication bootstrap tag');

for (const id of ['controlSignInRole', 'controlSignInId', 'controlSignInPassword', 'openRegisterUser', 'controlRegisterForm', 'backToSignIn']) {
  if (!new RegExp(`\\bid=["']${id}["']`, 'iu').test(signIn + register)) {
    throw new Error(`Production authentication smoke fixture is missing ${id}.`);
  }
}

const fixture = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Assurance Regent authentication production DOM smoke</title>
${styles}
</head>
<body class="auth-required">
  <main class="app-shell" aria-hidden="true"></main>
  ${signIn}
  ${register}
  <dialog id="authSmokeCompetingDialog" open aria-label="Synthetic competing dialog">
    <button type="button">Synthetic blocker</button>
  </dialog>
  ${bootstrap}
  <script>
    // No application runtime is loaded here: the form markup, production CSS,
    // and auth bootstrap are copied verbatim from public/index.html. This keeps
    // the pointer/top-layer test deterministic while static verification checks
    // that app.js owns and binds the canonical Supabase auth handlers.
    setTimeout(() => {
      document.body.dataset.smokeBlockerOpen = String(document.getElementById('authSmokeCompetingDialog')?.hasAttribute('open') || false);
    }, 900);
    setTimeout(() => {
      const body = document.body;
      const pass = body.dataset.authSmoke === 'pass'
        && body.dataset.authSmokeHitTargets === 'true'
        && body.dataset.authSmokeSignup === 'true'
        && body.dataset.authSmokeBack === 'true'
        && body.dataset.smokeBlockerOpen === 'false';
      const detail = new URLSearchParams({
        hit: body.dataset.authSmokeHitTargets || 'missing',
        signup: body.dataset.authSmokeSignup || 'missing',
        back: body.dataset.authSmokeBack || 'missing',
        blocker: body.dataset.smokeBlockerOpen || 'missing',
      });
      fetch('/__auth_smoke_' + (pass ? 'pass' : 'fail') + '?' + detail.toString(), {
        cache: 'no-store',
        credentials: 'same-origin',
      }).catch(() => {});
    }, 1200);
  </script>
</body>
</html>`;

writeFileSync(outPath, fixture, 'utf8');
console.log('[auth-smoke-fixture] generated from exact public/index.html authentication markup and production assets.');
