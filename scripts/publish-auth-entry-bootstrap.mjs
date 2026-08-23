import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
const bootstrapPath = resolve(publicDir, 'auth-entry-bootstrap.js');
const cssPath = resolve(publicDir, 'auth-entry.css');

if (!existsSync(indexPath)) throw new Error('Published public/index.html is missing.');

const authCss = `/* Assurance Regent v6.3.127 — deterministic authentication interaction layer. */
body.auth-required{overflow:hidden!important}
body.auth-required>.app-shell,
body.auth-required>.control-drawer,
body.auth-required>.control-drawer-backdrop,
body.auth-required>.toast,
body.auth-required>dialog:not(.auth-entry-dialog){pointer-events:none!important}
.auth-entry-backdrop{display:none}
body.auth-required>.auth-entry-backdrop{
  display:block!important;
  position:fixed!important;
  inset:0!important;
  z-index:2147483600!important;
  pointer-events:auto!important;
  background:rgba(7,31,43,.72)!important;
  backdrop-filter:blur(9px)!important;
  -webkit-backdrop-filter:blur(9px)!important;
}
body.auth-required>dialog.auth-entry-dialog{
  display:none!important;
  position:fixed!important;
  top:50%!important;
  left:50%!important;
  right:auto!important;
  bottom:auto!important;
  transform:translate(-50%,-50%)!important;
  margin:0!important;
  max-height:calc(100dvh - 28px)!important;
  overflow:auto!important;
  z-index:2147483601!important;
  pointer-events:auto!important;
  isolation:isolate!important;
}
body.auth-required>dialog.auth-entry-dialog[open]{display:block!important}
body.auth-required>dialog.auth-entry-dialog[open],
body.auth-required>dialog.auth-entry-dialog[open] *{pointer-events:auto!important}
body.auth-required>dialog.auth-entry-dialog::backdrop{display:none!important;background:transparent!important;backdrop-filter:none!important}
body.auth-required>dialog.auth-entry-dialog[inert],
body.auth-required>dialog.auth-entry-dialog[open][inert]{pointer-events:auto!important}
@media(max-width:760px){
  body.auth-required>dialog.auth-entry-dialog{width:min(520px,calc(100vw - 20px))!important;max-height:calc(100dvh - 20px)!important}
}
`;

const bootstrap = `(() => {
  'use strict';

  const SIGN_IN_ID = 'controlSignInDialog';
  const REGISTER_ID = 'controlRegisterDialog';
  const AUTH_IDS = new Set([SIGN_IN_ID, REGISTER_ID]);
  const SUPABASE_URL = 'https://fubqwljypdiojpbdunjc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bCscsMezuyabUbEA3gaXfw_awPFhqRq';
  const SESSION_TOKEN_KEY = 'assurance-regent-supabase-session-v460';
  const SESSION_USER_KEY = 'assurance-regent-supabase-user-v460';
  const html = document.documentElement;
  let observer = null;
  let repairing = false;
  let fallbackBusy = false;

  const getSignIn = () => document.getElementById(SIGN_IN_ID);
  const getRegister = () => document.getElementById(REGISTER_ID);
  const authRequired = () => Boolean(document.body?.classList.contains('auth-required'));

  const ensureBackdrop = () => {
    let backdrop = document.getElementById('authEntryBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'authEntryBackdrop';
      backdrop.className = 'auth-entry-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body?.appendChild(backdrop);
    }
    return backdrop;
  };

  const rawClose = (dialog) => {
    if (!dialog) return;
    dialog.removeAttribute('open');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.removeAttribute('inert');
  };

  const showOnly = (dialog, focus = false) => {
    if (!dialog || !authRequired()) return;
    const signIn = getSignIn();
    const register = getRegister();
    [signIn, register].forEach((candidate) => {
      if (!candidate) return;
      candidate.removeAttribute('inert');
      if (candidate === dialog) {
        candidate.setAttribute('open', '');
        candidate.removeAttribute('aria-hidden');
        candidate.setAttribute('aria-modal', 'true');
      } else {
        rawClose(candidate);
      }
    });
    ensureBackdrop();
    html.dataset.authEntryBootstrap = 'open';
    html.dataset.authEntryInteractive = 'ready';
    if (focus) {
      const target = dialog.querySelector('select:not([disabled]),input:not([disabled]),button:not([disabled])');
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  };

  const installDialogAdapter = (dialog) => {
    if (!dialog || dialog.dataset.authEntryAdapter === 'fixed-layer') return;

    // Authentication deliberately does not use the browser's native dialog top
    // layer. The previous top-layer stack could render the form while another
    // invisible modal still owned pointer and keyboard input.
    try {
      if (dialog.open && typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.close) {
        HTMLDialogElement.prototype.close.call(dialog);
      }
    } catch (_) {
      rawClose(dialog);
    }

    const show = () => showOnly(dialog, true);
    const close = () => rawClose(dialog);
    try {
      Object.defineProperty(dialog, 'showModal', { value: show, configurable: true });
      Object.defineProperty(dialog, 'show', { value: show, configurable: true });
      Object.defineProperty(dialog, 'close', { value: close, configurable: true });
    } catch (_) {
      dialog.showModal = show;
      dialog.show = show;
      dialog.close = close;
    }
    dialog.dataset.authEntryAdapter = 'fixed-layer';
  };

  const closeCompetingDialogs = () => {
    if (!authRequired()) return;
    document.querySelectorAll('dialog[open]').forEach((dialog) => {
      if (AUTH_IDS.has(dialog.id)) return;
      try {
        if (typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.close) {
          HTMLDialogElement.prototype.close.call(dialog);
        } else {
          dialog.removeAttribute('open');
        }
      } catch (_) {
        dialog.removeAttribute('open');
      }
    });
    document.querySelectorAll('[popover]').forEach((popover) => {
      try {
        if (popover.matches(':popover-open') && typeof popover.hidePopover === 'function') popover.hidePopover();
      } catch (_) {}
    });
  };

  const normalizeControls = (dialog) => {
    if (!dialog) return;
    dialog.removeAttribute('inert');
    dialog.querySelectorAll('[inert]').forEach((element) => element.removeAttribute('inert'));
  };

  const ensureAuthInteractive = () => {
    if (!authRequired()) {
      document.getElementById('authEntryBackdrop')?.remove();
      return;
    }
    const signIn = getSignIn();
    const register = getRegister();
    if (!signIn || !register) return;

    installDialogAdapter(signIn);
    installDialogAdapter(register);
    closeCompetingDialogs();
    normalizeControls(signIn);
    normalizeControls(register);

    if (register.hasAttribute('open')) showOnly(register, false);
    else showOnly(signIn, false);
  };

  const queueRepair = () => {
    if (repairing) return;
    repairing = true;
    queueMicrotask(() => {
      repairing = false;
      ensureAuthInteractive();
    });
  };

  const setSignInMessage = (message = '', kind = 'error') => {
    const el = document.getElementById('controlSignInError');
    if (!el) return;
    el.textContent = String(message || '');
    el.hidden = !message;
    el.dataset.authMessageKind = kind;
  };

  const setRegisterMessage = (message = '', kind = 'error') => {
    const el = document.getElementById('registerVoiceStatus');
    if (!el) return;
    el.textContent = String(message || '');
    el.classList.toggle('error', kind === 'error');
    el.classList.toggle('success', kind === 'success');
  };

  const rpc = async (name, payload) => {
    const response = await fetch(\`${SUPABASE_URL}/rest/v1/rpc/\${name}\`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
    if (!response.ok) {
      throw new Error(body?.message || body?.error || body?.hint || String(body || \`Authentication request failed (\${response.status}).\`));
    }
    return body;
  };

  const fallbackSignIn = async (form) => {
    if (fallbackBusy || !authRequired()) return;
    fallbackBusy = true;
    const submit = form?.querySelector('button[type="submit"]');
    const original = submit?.textContent || 'Sign in';
    try {
      if (submit) { submit.disabled = true; submit.textContent = 'Signing in…'; }
      setSignInMessage('');
      const username = document.getElementById('controlSignInId')?.value.trim() || '';
      const password = document.getElementById('controlSignInPassword')?.value || '';
      const role = document.getElementById('controlSignInRole');
      if (!username || !password) throw new Error('Username and password are required.');
      if (username.toLowerCase() === 'dvp' && role) role.value = 'Developer';
      const login = await rpc('assurance_regent_browser_login', {
        p_username: username,
        p_password: password,
        p_role: role?.value || 'Employee',
      });
      const token = login?.token || '';
      const userId = login?.user?.id || login?.userId || username;
      if (!token) throw new Error('Supabase did not return a login session.');
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_USER_KEY, String(userId));
      html.dataset.authFallback = 'login-complete';
      location.reload();
    } catch (error) {
      setSignInMessage(error?.message || 'Could not sign in.');
      html.dataset.authFallback = 'login-error';
      if (submit) { submit.disabled = false; submit.textContent = original; }
      fallbackBusy = false;
      showOnly(getSignIn(), false);
    }
  };

  const fallbackRegister = async (form) => {
    if (fallbackBusy || !authRequired()) return;
    fallbackBusy = true;
    const submit = form?.querySelector('button[type="submit"]');
    const original = submit?.textContent || 'Create account';
    try {
      if (submit) { submit.disabled = true; submit.textContent = 'Creating account…'; }
      const payload = {
        userId: document.getElementById('registerUserId')?.value.trim() || '',
        companyCode: document.getElementById('registerCompanyCode')?.value.trim() || '',
        name: document.getElementById('registerName')?.value.trim() || '',
        position: document.getElementById('registerPosition')?.value.trim() || '',
        email: document.getElementById('registerEmail')?.value.trim() || '',
        password: document.getElementById('registerPassword')?.value || '',
        role: document.getElementById('registerUserType')?.value || 'Employee',
      };
      if (payload.role === 'Developer') throw new Error('Developer accounts can only be created by an approved Developer.');
      setRegisterMessage('Creating your governed account…');
      const result = await rpc('assurance_regent_browser_register', {
        p_user_id: payload.userId,
        p_company_code: payload.companyCode,
        p_name: payload.name,
        p_position: payload.position,
        p_email: payload.email,
        p_password: payload.password,
        p_role: payload.role,
      });
      form?.reset();
      const message = result?.message || 'Account created. A Developer must approve it before you can sign in.';
      setSignInMessage(message, 'success');
      html.dataset.authFallback = 'register-complete';
      showOnly(getSignIn(), true);
    } catch (error) {
      setRegisterMessage(error?.message || 'Could not create account.', 'error');
      html.dataset.authFallback = 'register-error';
      showOnly(getRegister(), false);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = original; }
      fallbackBusy = false;
    }
  };

  const bindEntryControls = () => {
    const signIn = getSignIn();
    const register = getRegister();
    const signInForm = document.getElementById('controlSignInForm');
    const registerForm = document.getElementById('controlRegisterForm');
    const openRegister = document.getElementById('openRegisterUser');
    const backToSignIn = document.getElementById('backToSignIn');

    // Prevent method=dialog from closing the auth surface before an async RPC
    // finishes. The application handler still receives the event. If the large
    // application runtime has not bound its handler yet, a small direct-Supabase
    // fallback completes the same password login or governed registration RPC.
    signInForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      setTimeout(() => {
        const submit = form?.querySelector('button[type="submit"]');
        const appHandlerRunning = Boolean(submit?.disabled || /signing in/i.test(submit?.textContent || ''));
        if (!appHandlerRunning && authRequired()) fallbackSignIn(form);
      }, 120);
    }, { capture: true });

    registerForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      setTimeout(() => {
        const state = document.getElementById('registerVoiceEnrollment')?.dataset.jeevanState || '';
        const appHandlerRunning = Boolean(state && state !== 'READY' && state !== 'OPTIONAL' && state !== 'SAMPLES READY');
        if (!appHandlerRunning && authRequired()) fallbackRegister(form);
      }, 120);
    }, { capture: true });

    openRegister?.addEventListener('click', (event) => {
      event.preventDefault();
      showOnly(register, true);
    }, { capture: true });

    backToSignIn?.addEventListener('click', (event) => {
      event.preventDefault();
      showOnly(signIn, true);
    }, { capture: true });
  };

  const runSmokeProbe = () => {
    const params = new URLSearchParams(location.search);
    if (!params.has('auth-smoke')) return;
    setTimeout(() => {
      const signIn = getSignIn();
      const register = getRegister();
      const controls = [
        document.getElementById('controlSignInRole'),
        document.getElementById('controlSignInId'),
        document.getElementById('controlSignInPassword'),
        document.getElementById('openRegisterUser'),
        document.querySelector('#controlSignInForm button[type="submit"]'),
      ];
      const hit = (element) => {
        if (!element || element.disabled) return false;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === element || element.contains(target);
      };
      const initialHit = Boolean(signIn?.hasAttribute('open')) && controls.every(hit);
      document.getElementById('openRegisterUser')?.click();
      const signupSwitch = Boolean(register?.hasAttribute('open')) && !signIn?.hasAttribute('open');
      document.getElementById('backToSignIn')?.click();
      const backSwitch = Boolean(signIn?.hasAttribute('open')) && !register?.hasAttribute('open');
      const pass = initialHit && signupSwitch && backSwitch && html.dataset.authEntryInteractive === 'ready';
      document.body.dataset.authSmoke = pass ? 'pass' : 'fail';
      document.body.dataset.authSmokeHitTargets = String(initialHit);
      document.body.dataset.authSmokeSignup = String(signupSwitch);
      document.body.dataset.authSmokeBack = String(backSwitch);
    }, 700);
  };

  const start = () => {
    if (html.dataset.authEntryStarted === 'true') return;
    html.dataset.authEntryStarted = 'true';
    html.dataset.authEntryBootstrap = 'ready';
    ensureAuthInteractive();
    bindEntryControls();
    runSmokeProbe();

    observer = new MutationObserver(queueRepair);
    observer.observe(document.body || document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'inert', 'class'],
      childList: true,
    });

    setTimeout(ensureAuthInteractive, 100);
    setTimeout(ensureAuthInteractive, 500);
    setTimeout(ensureAuthInteractive, 1500);
  };

  // The dialog markup precedes this script in public/index.html, so install the
  // adapter synchronously before app.js can call showModal().
  start();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAuthInteractive, { once: true });
  }
})();
`;

writeFileSync(bootstrapPath, bootstrap, 'utf8');
writeFileSync(cssPath, authCss, 'utf8');

const digest = (source) => ({
  version: createHash('sha256').update(source).digest('hex').slice(0, 16),
  integrity: `sha384-${createHash('sha384').update(source).digest('base64')}`,
});
const jsDigest = digest(bootstrap);
const cssDigest = digest(authCss);
const scriptTag = `  <script src="./auth-entry-bootstrap.js?v=${jsDigest.version}" integrity="${jsDigest.integrity}" crossorigin="anonymous"></script>\n`;
const styleTag = `  <link rel="stylesheet" href="./auth-entry.css?v=${cssDigest.version}" integrity="${cssDigest.integrity}" crossorigin="anonymous" />\n`;

let html = readFileSync(indexPath, 'utf8');
if (!/<dialog\b[^>]*\bid=["']controlSignInDialog["']/iu.test(html)) throw new Error('Published sign-in dialog is missing.');
if (!/<dialog\b[^>]*\bid=["']controlRegisterDialog["']/iu.test(html)) throw new Error('Published sign-up dialog is missing.');
if (!/\bid=["']controlSignInId["']/iu.test(html)) throw new Error('Published sign-in identifier field is missing.');
if (!/\bid=["']controlSignInPassword["']/iu.test(html)) throw new Error('Published sign-in password field is missing.');
if (!/\bid=["']openRegisterUser["']/iu.test(html)) throw new Error('Published sign-up entry control is missing.');
if (!/\bid=["']backToSignIn["']/iu.test(html)) throw new Error('Published return-to-sign-in control is missing.');

html = html.replace(/\s*<script\b[^>]*\bsrc=["']\.\/auth-entry-bootstrap\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/giu, '\n');
html = html.replace(/\s*<link\b[^>]*\bhref=["']\.\/auth-entry\.css(?:\?[^"']*)?["'][^>]*\/?>\s*/giu, '\n');
if (!/<\/head>/iu.test(html)) throw new Error('Published HTML has no closing head tag.');
html = html.replace(/<\/head>/iu, `${styleTag}</head>`);

const appTag = /<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
if (!appTag.test(html)) throw new Error('Published application runtime tag is missing.');
html = html.replace(appTag, (match) => `${scriptTag}${match}`);

writeFileSync(indexPath, html, 'utf8');
console.log(`[auth-entry] published fixed-layer authentication runtime js=${jsDigest.version} css=${cssDigest.version}.`);
