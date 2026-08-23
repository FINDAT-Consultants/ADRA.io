import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
const outPath = resolve(publicDir, 'auth-entry-production-smoke.html');
let html = readFileSync(indexPath, 'utf8');

for (const id of ['controlSignInRole','controlSignInId','controlSignInPassword','openRegisterUser','controlRegisterForm','backToSignIn']) {
  if (!new RegExp(`\\bid=["']${id}["']`, 'iu').test(html)) throw new Error(`Production authentication page is missing ${id}.`);
}
if (!/type=["']application\/x-assurance-regent-runtime["'][^>]*src=["']\.\/app/iu.test(html)) {
  throw new Error('Production smoke requires app.js to be inert before authentication.');
}

const bootstrapPattern = /<script\b[^>]*\bsrc=["']\.\/auth-entry-bootstrap\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
const bootstrapTag = html.match(bootstrapPattern)?.[0];
if (!bootstrapTag) throw new Error('Production authentication gateway tag is missing.');

const blocker = `\n  <dialog id="authSmokeCompetingDialog" open aria-label="Synthetic competing dialog"><button type="button">Synthetic blocker</button></dialog>\n`;
html = html.replace(bootstrapTag, `${blocker}${bootstrapTag}`);

const reporter = `
<script>
  setTimeout(() => {
    const body = document.body;
    body.dataset.smokeBlockerOpen = String(document.getElementById('authSmokeCompetingDialog')?.hasAttribute('open') || false);
    const pass = body.dataset.authSmoke === 'pass'
      && body.dataset.authSmokeHitTargets === 'true'
      && body.dataset.authSmokeSignup === 'true'
      && body.dataset.authSmokeBack === 'true'
      && body.dataset.authSmokeRuntimeDormant === 'true'
      && body.dataset.authSmokeHeartbeat === 'alive'
      && body.dataset.smokeBlockerOpen === 'false'
      && document.documentElement.dataset.fullRuntimeStarted !== 'true';
    const detail = new URLSearchParams({
      hit: body.dataset.authSmokeHitTargets || 'missing',
      signup: body.dataset.authSmokeSignup || 'missing',
      back: body.dataset.authSmokeBack || 'missing',
      dormant: body.dataset.authSmokeRuntimeDormant || 'missing',
      heartbeat: body.dataset.authSmokeHeartbeat || 'missing',
      blocker: body.dataset.smokeBlockerOpen || 'missing',
      runtimeStarted: document.documentElement.dataset.fullRuntimeStarted || 'false',
    });
    fetch('/__auth_smoke_' + (pass ? 'pass' : 'fail') + '?' + detail.toString(), { cache: 'no-store', credentials: 'same-origin' }).catch(() => {});
  }, 1300);
</script>
`;
if (!/<\/body>/iu.test(html)) throw new Error('Production index has no closing body tag.');
html = html.replace(/<\/body>/iu, `${reporter}</body>`);

writeFileSync(outPath, html, 'utf8');
console.log('[auth-smoke-fixture] generated from the complete production page; full runtime must remain inert while signed out.');
