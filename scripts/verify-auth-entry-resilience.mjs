import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceApp = readFileSync(resolve(root, 'app.js'), 'utf8');
const sourceHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
const publicHtml = readFileSync(resolve(root, 'public/index.html'), 'utf8');
const RUNTIME_TYPE = 'application/x-assurance-regent-runtime';

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function verifyRuntime(source, label) {
  requireMatch(source, /function\s+ensureAuthEntryVisible\s*\(\)/u, `${label} is missing the application authentication recovery guard.`);
  requireMatch(source, /async\s+function\s+signInControlUser\s*\(/u, `${label} is missing its authenticated-runtime sign-in fallback.`);
  requireMatch(source, /async\s+function\s+registerControlUserUi\s*\(/u, `${label} is missing its authenticated-runtime registration fallback.`);
  requireMatch(source, /assurance_regent_browser_login/u, `${label} is not wired to the governed login RPC.`);
  requireMatch(source, /assurance_regent_browser_register/u, `${label} is not wired to the governed registration RPC.`);
  requireMatch(source, /boot\s*\(\)\.catch\s*\(/u, `${label} does not recover when full application startup fails.`);
}

function verifyHtml(source, label) {
  requireMatch(source, /<body\b[^>]*\bclass=["'][^"']*\bauth-required\b[^"']*["']/iu, `${label} does not start behind the authentication gate.`);
  for (const id of ['controlSignInDialog','controlSignInForm','controlSignInRole','controlSignInId','controlSignInPassword','openRegisterUser','controlRegisterDialog','controlRegisterForm','backToSignIn']) {
    requireMatch(source, new RegExp(`\\bid=["']${id}["']`, 'iu'), `${label} is missing ${id}.`);
  }
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
if (!cssTag) throw new Error('Published index does not load the authentication gateway stylesheet.');
const bootstrapTag = publicHtml.match(/<script\b[^>]*\bsrc=["']\.\/(auth-entry-bootstrap\.js)(?:\?[^"']*)?["'][^>]*><\/script>/iu);
if (!bootstrapTag) throw new Error('Published index does not load the lightweight authentication gateway.');
const appTag = publicHtml.match(new RegExp(`<script\\b[^>]*\\btype=["']${RUNTIME_TYPE.replaceAll('/', '\\/')}["'][^>]*\\bsrc=["']\\./(app(?:\\.[^"'?]+)?\\.js)(?:\\?[^"']*)?["'][^>]*><\\/script>`, 'iu'));
if (!appTag) throw new Error('Published application runtime is not registered as an inert post-authentication script.');

const directAppTag = [...publicHtml.matchAll(/<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/giu)]
  .find((match) => !new RegExp(`\\btype=["']${RUNTIME_TYPE.replaceAll('/', '\\/')}["']`, 'iu').test(match[0]));
if (directAppTag) throw new Error('Main app.js is still directly executable before authentication.');

const bodyStart = publicHtml.search(/<body\b/iu);
const bodyHtml = bodyStart >= 0 ? publicHtml.slice(bodyStart) : '';
const inertScripts = [...bodyHtml.matchAll(new RegExp(`<script\\b[^>]*\\btype=["']${RUNTIME_TYPE.replaceAll('/', '\\/')}["'][^>]*\\bsrc=["'][^"']+["'][^>]*><\\/script>`, 'giu'))];
if (inertScripts.length < 5) throw new Error(`Expected the body runtime bundle to be gated; only ${inertScripts.length} inert scripts were found.`);

const headEnd = publicHtml.search(/<\/head>/iu);
const cssPosition = publicHtml.indexOf(cssTag[0]);
const bootstrapPosition = publicHtml.indexOf(bootstrapTag[0]);
const appPosition = publicHtml.indexOf(appTag[0]);
if (headEnd < 0 || cssPosition < 0 || cssPosition > headEnd) throw new Error('Authentication gateway CSS must load from the document head.');
if (bootstrapPosition < 0 || appPosition < 0 || bootstrapPosition > appPosition) throw new Error('Authentication gateway must execute before the inert full runtime manifest.');

const cssPath = resolve(root, 'public', cssTag[1]);
const bootstrapPath = resolve(root, 'public', bootstrapTag[1]);
if (!existsSync(cssPath) || !existsSync(bootstrapPath)) throw new Error('Published authentication assets are missing.');
const css = readFileSync(cssPath, 'utf8');
const bootstrap = readFileSync(bootstrapPath, 'utf8');

requireMatch(css, /auth-entry-backdrop/u, 'Authentication CSS is missing the deterministic backdrop layer.');
requireMatch(css, />dialog\.auth-entry-dialog\[open\]/u, 'Authentication CSS does not expose only the active auth surface.');
requireMatch(css, /pointer-events:auto!important/u, 'Authentication CSS does not explicitly preserve pointer interaction.');
requireMatch(css, /z-index:2147483601!important/u, 'Authentication CSS does not isolate authentication above the application shell.');
requireMatch(css, /auth-lite-disabled/u, 'Authentication CSS does not suppress unavailable heavyweight voice controls in lightweight mode.');

requireMatch(bootstrap, /const VERSION = '6\.3\.128'/u, 'Authentication gateway is not v6.3.128.');
requireMatch(bootstrap, /application\/x-assurance-regent-runtime/u, 'Authentication gateway does not own the inert runtime gate.');
requireMatch(bootstrap, /assurance_regent_browser_login/u, 'Lightweight gateway cannot sign in without app.js.');
requireMatch(bootstrap, /assurance_regent_browser_register/u, 'Lightweight gateway cannot register without app.js.');
requireMatch(bootstrap, /assurance_regent_browser_session_status/u, 'Lightweight gateway does not validate stored sessions before loading app.js.');
requireMatch(bootstrap, /loadRuntimeScripts/u, 'Authentication gateway cannot activate the full runtime after session validation.');
requireMatch(bootstrap, /location\.reload\(\)/u, 'Successful lightweight sign-in does not reload into authenticated runtime mode.');
requireMatch(bootstrap, /controlSignInId/u, 'Authentication gateway is not bound to the real sign-in identifier field.');
requireMatch(bootstrap, /backToSignIn/u, 'Authentication gateway does not preserve sign-up to sign-in navigation.');
requireMatch(bootstrap, /Object\.defineProperty\(dialog,\s*'showModal'/u, 'Authentication gateway does not intercept native modal reopening.');
requireMatch(bootstrap, /__assuranceRegentAuthGate128/u, 'Authentication global dialog gate is not idempotently marked.');
requireMatch(bootstrap, /element\.getAttribute\(name\) !== value/u, 'Authentication DOM writes are not idempotent.');
requireMatch(bootstrap, /auth-smoke/u, 'Authentication gateway is missing the production smoke probe.');
requireMatch(bootstrap, /authSmokeRuntimeDormant/u, 'Smoke probe does not prove the full runtime stays dormant before authentication.');
requireMatch(bootstrap, /elementFromPoint/u, 'Authentication smoke probe does not verify browser hit targets.');
requireMatch(bootstrap, /\n\s*start\(\);\n/u, 'Authentication gateway is not installed synchronously.');

if (/new\s+MutationObserver\s*\(/u.test(bootstrap)) throw new Error('Authentication gateway must not construct a MutationObserver.');
if (/queueMicrotask\s*\(/u.test(bootstrap)) throw new Error('Authentication gateway must not run a microtask repair loop.');
if (/setInterval\s*\(/u.test(bootstrap)) throw new Error('Authentication gateway must not run repeating timers.');
if (/createElement\(['"]style['"]\)/u.test(bootstrap)) throw new Error('Authentication gateway must not create inline style elements under the production CSP.');

verifyIntegrity(cssTag[0], css, 'Published authentication CSS');
verifyVersion(cssTag[0], css, 'Published authentication CSS');
verifyIntegrity(bootstrapTag[0], bootstrap, 'Published authentication gateway');
verifyVersion(bootstrapTag[0], bootstrap, 'Published authentication gateway');

const publicAppName = appTag[1];
const publicApp = readFileSync(resolve(root, 'public', publicAppName), 'utf8');
verifyRuntime(publicApp, `Published ${publicAppName}`);
verifyIntegrity(appTag[0], publicApp, 'Published inert application runtime');

console.log(`[auth-entry] OK: lightweight gateway owns login/register, validates sessions, keeps ${inertScripts.length} full-runtime scripts inert while signed out, and only activates them after authentication.`);
