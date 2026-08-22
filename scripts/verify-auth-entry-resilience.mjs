import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceApp = readFileSync(resolve(root, 'app.js'), 'utf8');
const sourceHtml = readFileSync(resolve(root, 'index.html'), 'utf8');
const publicHtml = readFileSync(resolve(root, 'public/index.html'), 'utf8');

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function verifyRuntime(source, label) {
  requireMatch(source, /function\s+ensureAuthEntryVisible\s*\(\)/u, `${label} is missing the authentication entry guard.`);
  requireMatch(source, /if\s*\(!browserSessionToken\)\s*ensureAuthEntryVisible\s*\(\)/u, `${label} does not open authentication before Supabase startup.`);
  requireMatch(source, /const\s+authEntryGuard\s*=\s*setTimeout\s*\(ensureAuthEntryVisible\s*,\s*1800\s*\)/u, `${label} is missing the delayed authentication fallback.`);
  requireMatch(source, /boot\s*\(\)\.catch\s*\(/u, `${label} does not recover when application startup fails.`);

  const guardCall = source.indexOf('if(!browserSessionToken)ensureAuthEntryVisible()');
  const healthCall = source.indexOf('const supabaseHealth=await verifySupabaseSetup()');
  if (guardCall < 0 || healthCall < 0 || guardCall > healthCall) {
    throw new Error(`${label} waits for Supabase before exposing authentication.`);
  }
}

function verifyHtml(source, label) {
  requireMatch(source, /<body\b[^>]*\bclass=["'][^"']*\bauth-required\b[^"']*["']/iu, `${label} does not start behind the authentication gate.`);
  requireMatch(source, /<dialog\b[^>]*\bid=["']controlSignInDialog["']/iu, `${label} is missing the sign-in dialog.`);
  requireMatch(source, /<dialog\b[^>]*\bid=["']controlRegisterDialog["']/iu, `${label} is missing the sign-up dialog.`);
  requireMatch(source, /\bid=["']openRegisterUser["']/iu, `${label} is missing the sign-up control.`);
}

function verifyIntegrity(tag, contents, label) {
  const integrity = tag.match(/\bintegrity=["']sha384-([^"']+)["']/iu)?.[1];
  if (!integrity) throw new Error(`${label} is missing SHA-384 integrity protection.`);
  const actualIntegrity = createHash('sha384').update(contents).digest('base64');
  if (integrity !== actualIntegrity) throw new Error(`${label} integrity hash is stale.`);
}

verifyRuntime(sourceApp, 'Source app.js');
verifyHtml(sourceHtml, 'Source index.html');
verifyHtml(publicHtml, 'Published public/index.html');

const bootstrapTag = publicHtml.match(/<script\b[^>]*\bsrc=["']\.\/(auth-entry-bootstrap\.js)(?:\?[^"']*)?["'][^>]*><\/script>/iu);
if (!bootstrapTag) throw new Error('Published index does not load the independent authentication entry bootstrap.');
const appTag = publicHtml.match(/<script\b[^>]*\bsrc=["']\.\/(app(?:\.[^"'?]+)?\.js)(?:\?[^"']*)?["'][^>]*><\/script>/iu);
if (!appTag) throw new Error('Published index does not load an application runtime.');

const bootstrapPosition = publicHtml.indexOf(bootstrapTag[0]);
const appPosition = publicHtml.indexOf(appTag[0]);
if (bootstrapPosition < 0 || appPosition < 0 || bootstrapPosition > appPosition) {
  throw new Error('Independent authentication entry bootstrap must load before the main application runtime.');
}

const bootstrap = readFileSync(resolve(root, 'public', bootstrapTag[1]), 'utf8');
requireMatch(bootstrap, /controlSignInDialog/u, 'Authentication entry bootstrap does not target the sign-in dialog.');
requireMatch(bootstrap, /auth-required/u, 'Authentication entry bootstrap does not respect the authentication gate.');
requireMatch(bootstrap, /\bstart\s*\(\s*\)\s*;/u, 'Authentication entry bootstrap does not open synchronously before the main runtime.');
verifyIntegrity(bootstrapTag[0], bootstrap, 'Published authentication entry bootstrap');

const publicAppName = appTag[1];
const publicApp = readFileSync(resolve(root, 'public', publicAppName), 'utf8');
verifyRuntime(publicApp, `Published ${publicAppName}`);
verifyIntegrity(appTag[0], publicApp, 'Published application runtime');

console.log(`[auth-entry] OK: sign-in/sign-up markup, independent auth bootstrap, and resilient startup guards verified before public/${publicAppName}.`);
