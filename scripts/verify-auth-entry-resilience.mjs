import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceApp = readFileSync(resolve(root, 'app.js'), 'utf8');
const sourceHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
const publicHtml = readFileSync(resolve(root, 'public/index.html'), 'utf8');

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function verifyRuntime(source, label) {
  requireMatch(source, /function\s+ensureAuthEntryVisible\s*\(\)/u, `${label} is missing the application authentication recovery guard.`);
  requireMatch(source, /if\s*\(!browserSessionToken\)\s*ensureAuthEntryVisible\s*\(\)/u, `${label} does not expose authentication before Supabase startup.`);
  requireMatch(source, /boot\s*\(\)\.catch\s*\(/u, `${label} does not recover when application startup fails.`);

  const guardCall = source.indexOf('if(!browserSessionToken)ensureAuthEntryVisible()');
  const healthCall = source.indexOf('const supabaseHealth=await verifySupabaseSetup()');
  if (guardCall < 0 || healthCall < 0 || guardCall > healthCall) {
    throw new Error(`${label} waits for Supabase before exposing authentication.`);
  }
}

function verifyHtml(source, label) {
  requireMatch(source, /<body\b[^>]*\bclass=["'][^"']*\bauth-required\b[^"']*["']/iu, `${label} does not start behind the authentication gate.`);
  requireMatch(source, /<dialog\b[^>]*\bid=["']controlSignInDialog["']/iu, `${label} is missing the sign-in surface.`);
  requireMatch(source, /<form\b[^>]*\bid=["']controlSignInForm["']/iu, `${label} is missing the sign-in form.`);
  requireMatch(source, /\bid=["']controlSignInRole["']/iu, `${label} is missing the real sign-in role selector.`);
  requireMatch(source, /\bid=["']controlSignInId["']/iu, `${label} is missing the real sign-in identifier field.`);
  requireMatch(source, /\bid=["']controlSignInPassword["']/iu, `${label} is missing the real sign-in password field.`);
  requireMatch(source, /\bid=["']openRegisterUser["']/iu, `${label} is missing the sign-up switch.`);
  requireMatch(source, /<dialog\b[^>]*\bid=["']controlRegisterDialog["']/iu, `${label} is missing the sign-up surface.`);
  requireMatch(source, /<form\b[^>]*\bid=["']controlRegisterForm["']/iu, `${label} is missing the sign-up form.`);
  requireMatch(source, /\bid=["']backToSignIn["']/iu, `${label} is missing the return-to-sign-in switch.`);
}

function verifyIntegrity(tag, contents, label) {
  const integrity = tag.match(/\bintegrity=["']sha384-([^"']+)["']/iu)?.[1];
  if (!integrity) throw new Error(`${label} is missing SHA-384 integrity protection.`);
  const actualIntegrity = createHash('sha384').update(contents).digest('base64');
  if (integrity !== actualIntegrity) throw new Error(`${label} integrity hash is stale.`);
}

function verifyVersion(tag, contents, label) {
  const version = tag.match(/[?&]v=([a-f0-9]{16})/iu)?.[1];
  if (!version) throw new Error(`${label} is missing a content-versioned URL.`);
  const actual = createHash('sha256').update(contents).digest('hex').slice(0, 16);
  if (version !== actual) throw new Error(`${label} content version is stale.`);
}

verifyRuntime(sourceApp, 'Source app.js');
verifyHtml(sourceHtml, 'Source index.html');
verifyHtml(publicHtml, 'Published public/index.html');

const cssTag = publicHtml.match(/<link\b[^>]*\bhref=["']\.\/(auth-entry\.css)(?:\?[^"']*)?["'][^>]*>/iu);
if (!cssTag) throw new Error('Published index does not load the static authentication interaction stylesheet.');
const bootstrapTag = publicHtml.match(/<script\b[^>]*\bsrc=["']\.\/(auth-entry-bootstrap\.js)(?:\?[^"']*)?["'][^>]*><\/script>/iu);
if (!bootstrapTag) throw new Error('Published index does not load the independent authentication bootstrap.');
const appTag = publicHtml.match(/<script\b[^>]*\bsrc=["']\.\/(app(?:\.[^"'?]+)?\.js)(?:\?[^"']*)?["'][^>]*><\/script>/iu);
if (!appTag) throw new Error('Published index does not load an application runtime.');

const headEnd = publicHtml.search(/<\/head>/iu);
const cssPosition = publicHtml.indexOf(cssTag[0]);
const bootstrapPosition = publicHtml.indexOf(bootstrapTag[0]);
const appPosition = publicHtml.indexOf(appTag[0]);
if (headEnd < 0 || cssPosition < 0 || cssPosition > headEnd) {
  throw new Error('Authentication interaction CSS must be loaded from the document head.');
}
if (bootstrapPosition < 0 || appPosition < 0 || bootstrapPosition > appPosition) {
  throw new Error('Authentication bootstrap must load before the main application runtime.');
}

const cssPath = resolve(root, 'public', cssTag[1]);
const bootstrapPath = resolve(root, 'public', bootstrapTag[1]);
if (!existsSync(cssPath) || !existsSync(bootstrapPath)) throw new Error('Published authentication assets are missing.');
const css = readFileSync(cssPath, 'utf8');
const bootstrap = readFileSync(bootstrapPath, 'utf8');

requireMatch(css, /auth-entry-backdrop/u, 'Authentication CSS is missing the deterministic backdrop layer.');
requireMatch(css, />dialog\.auth-entry-dialog\[open\]/u, 'Authentication CSS does not expose only the active auth surface.');
requireMatch(css, /pointer-events:auto!important/u, 'Authentication CSS does not explicitly preserve pointer interaction.');
requireMatch(css, /z-index:2147483601!important/u, 'Authentication CSS does not isolate the auth layer above the application shell.');

requireMatch(bootstrap, /controlSignInId/u, 'Authentication bootstrap is not bound to the real sign-in identifier field.');
requireMatch(bootstrap, /backToSignIn/u, 'Authentication bootstrap does not preserve sign-up to sign-in navigation.');
requireMatch(bootstrap, /authEntryAdapter/u, 'Authentication bootstrap does not install the deterministic dialog adapter.');
requireMatch(bootstrap, /fixed-layer/u, 'Authentication bootstrap is not configured for fixed-layer authentication.');
requireMatch(bootstrap, /Object\.defineProperty\(dialog,\s*'showModal'/u, 'Authentication bootstrap does not intercept native modal reopening.');
requireMatch(bootstrap, /showOnly/u, 'Authentication bootstrap does not enforce one active auth surface.');
requireMatch(bootstrap, /MutationObserver/u, 'Authentication bootstrap does not repair later runtime interference.');
requireMatch(bootstrap, /fallbackSignIn/u, 'Authentication bootstrap is missing the independent password sign-in fallback.');
requireMatch(bootstrap, /fallbackRegister/u, 'Authentication bootstrap is missing the independent governed registration fallback.');
requireMatch(bootstrap, /assurance_regent_browser_login/u, 'Authentication fallback does not call the governed login RPC.');
requireMatch(bootstrap, /assurance_regent_browser_register/u, 'Authentication fallback does not call the governed registration RPC.');
requireMatch(bootstrap, /assurance-regent-supabase-session-v460/u, 'Authentication fallback does not preserve the canonical browser session token key.');
requireMatch(bootstrap, /sessionStorage\.setItem/u, 'Authentication fallback does not persist a successful browser session.');
requireMatch(bootstrap, /auth-smoke/u, 'Authentication bootstrap is missing the real production DOM smoke probe.');
requireMatch(bootstrap, /elementFromPoint/u, 'Authentication smoke probe does not verify browser hit targets.');
requireMatch(bootstrap, /\n\s*start\(\);\n/u, 'Authentication adapter is not installed synchronously before app.js executes.');
if (/createElement\(['"]style['"]\)/u.test(bootstrap)) {
  throw new Error('Authentication bootstrap must not create inline style elements under the production CSP.');
}

verifyIntegrity(cssTag[0], css, 'Published authentication CSS');
verifyVersion(cssTag[0], css, 'Published authentication CSS');
verifyIntegrity(bootstrapTag[0], bootstrap, 'Published authentication bootstrap');
verifyVersion(bootstrapTag[0], bootstrap, 'Published authentication bootstrap');

const publicAppName = appTag[1];
const publicApp = readFileSync(resolve(root, 'public', publicAppName), 'utf8');
verifyRuntime(publicApp, `Published ${publicAppName}`);
verifyIntegrity(appTag[0], publicApp, 'Published application runtime');

console.log(`[auth-entry] OK: real auth DOM, fixed-layer pointer contract, CSP-safe synchronous adapter, independent Supabase login/register fallback, hit-target smoke probe, and application recovery guard verified before public/${publicAppName}.`);
