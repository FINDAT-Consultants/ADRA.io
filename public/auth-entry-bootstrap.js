(() => {
  'use strict';

  const VERSION = '6.3.128';
  const SIGN_IN_ID = 'controlSignInDialog';
  const REGISTER_ID = 'controlRegisterDialog';
  const AUTH_IDS = new Set([SIGN_IN_ID, REGISTER_ID]);
  const RUNTIME_TYPE = 'application/x-assurance-regent-runtime';
  const SUPABASE_URL = 'https://fubqwljypdiojpbdunjc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bCscsMezuyabUbEA3gaXfw_awPFhqRq';
  const SESSION_TOKEN_KEY = 'assurance-regent-supabase-session-v460';
  const SESSION_USER_KEY = 'assurance-regent-supabase-user-v460';
  const html = document.documentElement;
  const DialogProto = typeof HTMLDialogElement === 'undefined' ? null : HTMLDialogElement.prototype;
  const nativeShowModal = DialogProto?.showModal;
  const nativeShow = DialogProto?.show;
  const nativeClose = DialogProto?.close;
  let gatewayBound = false;
  let runtimeLoadPromise = null;

  const getSignIn = () => document.getElementById(SIGN_IN_ID);
  const getRegister = () => document.getElementById(REGISTER_ID);
  const authRequired = () => Boolean(document.body?.classList.contains('auth-required'));
  const sessionGet = (key) => { try { return sessionStorage.getItem(key) || ''; } catch (_) { return ''; } };
  const sessionSet = (key, value) => { try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch (_) {} };
  const clearSession = () => { sessionSet(SESSION_TOKEN_KEY, ''); sessionSet(SESSION_USER_KEY, ''); };

  const setAttr = (element, name, value = '') => {
    if (!element) return;
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const removeAttr = (element, name) => { if (element?.hasAttribute(name)) element.removeAttribute(name); };

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
    removeAttr(dialog, 'open');
    removeAttr(dialog, 'inert');
    setAttr(dialog, 'aria-hidden', 'true');
  };

  const rawOpen = (dialog) => {
    if (!dialog) return;
    dialog.classList.add('auth-entry-dialog');
    removeAttr(dialog, 'inert');
    setAttr(dialog, 'open', '');
    removeAttr(dialog, 'aria-hidden');
    setAttr(dialog, 'aria-modal', 'true');
  };

  const setSignInError = (message = '') => {
    const el = document.getElementById('controlSignInError');
    if (!el) return;
    el.textContent = String(message || '');
    el.hidden = !message;
  };

  const setButtonBusy = (button, busy, busyLabel) => {
    if (!button) return;
    if (!button.dataset.authIdleLabel) button.dataset.authIdleLabel = button.textContent || '';
    button.disabled = Boolean(busy);
    button.textContent = busy ? busyLabel : button.dataset.authIdleLabel;
  };

  const rpc = async (name, payload = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(name), {
        method: 'POST',
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
      if (!response.ok) {
        const message = body?.message || body?.error || body?.hint || String(body || 'Request failed (' + response.status + ').');
        throw new Error(message);
      }
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('The authentication service took too long to respond. Please try again.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const suppressCompetingTopLayers = () => {
    if (!authRequired()) return;
    document.querySelectorAll('dialog[open]').forEach((dialog) => {
      if (AUTH_IDS.has(dialog.id)) return;
      try { if (nativeClose) nativeClose.call(dialog); else removeAttr(dialog, 'open'); }
      catch (_) { removeAttr(dialog, 'open'); }
    });
    document.querySelectorAll('[popover]').forEach((popover) => {
      try { if (popover.matches(':popover-open') && typeof popover.hidePopover === 'function') popover.hidePopover(); } catch (_) {}
    });
  };

  const enableEntryControls = () => {
    document.querySelectorAll('#controlSignInDialog input,#controlSignInDialog select,#controlSignInDialog button,#controlRegisterDialog input,#controlRegisterDialog select,#controlRegisterDialog button').forEach((control) => {
      if (control.id !== 'registerVoiceRecord' && control.id !== 'registerVoiceReset' && control.id !== 'registerVoiceInstruction') control.disabled = false;
      removeAttr(control, 'inert');
    });
  };

  const hideUnavailableVoiceControls = () => {
    ['authVoiceLauncher', 'authVoicePanel', 'registerVoiceEnrollment'].forEach((id) => document.getElementById(id)?.classList.add('auth-lite-disabled'));
  };

  const hideAuthGate = () => {
    document.body?.classList.remove('auth-required');
    rawClose(getSignIn());
    rawClose(getRegister());
    document.getElementById('authEntryBackdrop')?.remove();
    html.dataset.authEntryBootstrap = 'closed';
    html.dataset.authEntryInteractive = 'ready';
  };

  const showOnly = (dialog, focus = false) => {
    if (!dialog || !document.body) return;
    document.body.classList.add('auth-required');
    removeAttr(html, 'inert');
    removeAttr(document.body, 'inert');
    const signIn = getSignIn();
    const register = getRegister();
    if (dialog === signIn) { rawClose(register); rawOpen(signIn); }
    else if (dialog === register) { rawClose(signIn); rawOpen(register); }
    else return;
    suppressCompetingTopLayers();
    ensureBackdrop();
    enableEntryControls();
    hideUnavailableVoiceControls();
    html.dataset.authEntryBootstrap = 'open';
    html.dataset.authEntryInteractive = 'ready';
    html.dataset.authGatewayVersion = VERSION;
    if (focus) {
      const target = dialog.querySelector('select:not([disabled]),input:not([disabled]),button:not([disabled])');
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  };

  const installDialogAdapter = (dialog) => {
    if (!dialog || dialog.dataset.authEntryAdapter === 'fixed-layer') return;
    dialog.classList.add('auth-entry-dialog');
    try { if (dialog.hasAttribute('open') && nativeClose) nativeClose.call(dialog); }
    catch (_) { removeAttr(dialog, 'open'); }
    const show = () => showOnly(dialog, true);
    const close = () => rawClose(dialog);
    try {
      Object.defineProperty(dialog, 'showModal', { value: show, configurable: true });
      Object.defineProperty(dialog, 'show', { value: show, configurable: true });
      Object.defineProperty(dialog, 'close', { value: close, configurable: true });
    } catch (_) {
      dialog.showModal = show; dialog.show = show; dialog.close = close;
    }
    dialog.dataset.authEntryAdapter = 'fixed-layer';
  };

  const installGlobalDialogGate = () => {
    if (!DialogProto || DialogProto.__assuranceRegentAuthGate128) return;
    if (nativeShowModal) DialogProto.showModal = function (...args) {
      if (authRequired() && !AUTH_IDS.has(this.id)) { rawClose(this); this.dataset.authSuppressed = 'true'; return; }
      return nativeShowModal.apply(this, args);
    };
    if (nativeShow) DialogProto.show = function (...args) {
      if (authRequired() && !AUTH_IDS.has(this.id)) { rawClose(this); this.dataset.authSuppressed = 'true'; return; }
      return nativeShow.apply(this, args);
    };
    Object.defineProperty(DialogProto, '__assuranceRegentAuthGate128', { value: true, configurable: true });
  };

  const ensureAuthInteractive = () => {
    const signIn = getSignIn();
    const register = getRegister();
    if (!signIn || !register) return;
    installDialogAdapter(signIn);
    installDialogAdapter(register);
    installGlobalDialogGate();
    if (sessionGet(SESSION_TOKEN_KEY)) {
      hideAuthGate();
      return;
    }
    if (!authRequired()) { document.getElementById('authEntryBackdrop')?.remove(); return; }
    removeAttr(html, 'inert');
    removeAttr(document.body, 'inert');
    suppressCompetingTopLayers();
    enableEntryControls();
    hideUnavailableVoiceControls();
    if (register.hasAttribute('open')) showOnly(register, false); else showOnly(signIn, false);
  };

  const copyScriptAttributes = (from, to) => {
    for (const attribute of from.attributes) {
      const name = attribute.name.toLowerCase();
      if (name === 'type' || name === 'src') continue;
      to.setAttribute(attribute.name, attribute.value);
    }
  };

  const loadRuntimeScripts = () => {
    if (runtimeLoadPromise) return runtimeLoadPromise;
    const pending = (async () => {
      if (html.dataset.fullRuntimeStarted === 'true') return;
      html.dataset.fullRuntimeStarted = 'true';
      const inertScripts = [...document.querySelectorAll('script[type="' + RUNTIME_TYPE + '"][src]')];
      if (!inertScripts.length) throw new Error('No Assurance Regent runtime scripts were registered.');
      for (const inert of inertScripts) {
        await new Promise((resolve, reject) => {
          const src = inert.getAttribute('src') || '';
          const script = document.createElement('script');
          let settled = false;
          const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            script.onload = null;
            script.onerror = null;
            if (error) reject(error); else resolve();
          };
          const timer = setTimeout(() => finish(new Error('Timed out loading ' + src)), 15000);
          copyScriptAttributes(inert, script);
          script.src = src;
          script.async = false;
          script.onload = () => { inert.dataset.runtimeLoaded = 'true'; finish(); };
          script.onerror = () => finish(new Error('Could not load ' + src));
          inert.after(script);
        });
      }
      html.dataset.fullRuntimeReady = 'true';
    })();
    runtimeLoadPromise = pending.catch((error) => {
      runtimeLoadPromise = null;
      html.dataset.fullRuntimeStarted = 'false';
      clearSession();
      document.body?.classList.add('auth-required');
      setSignInError('The application runtime could not start safely. Please sign in again.');
      showOnly(getSignIn(), false);
      console.error('[auth-gateway] runtime load failed', error);
      throw error;
    });
    return runtimeLoadPromise;
  };

  const activateAuthenticatedRuntime = async (button = null) => {
    html.dataset.authGatewayState = 'loading-runtime';
    if (button) setButtonBusy(button, true, 'Opening system…');
    hideAuthGate();
    await loadRuntimeScripts();
    html.dataset.authGatewayState = 'ready';
    if (button) setButtonBusy(button, false, 'Sign in');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const submit = form?.querySelector('button[type="submit"]');
    setSignInError('');
    setButtonBusy(submit, true, 'Signing in…');
    try {
      const username = document.getElementById('controlSignInId')?.value.trim() || '';
      const password = document.getElementById('controlSignInPassword')?.value || '';
      const role = document.getElementById('controlSignInRole')?.value || 'Employee';
      if (!username || !password) throw new Error('Enter your username and password.');
      const login = await rpc('assurance_regent_browser_login', { p_username: username, p_password: password, p_role: role });
      const token = login?.token || '';
      const userId = login?.user?.id || login?.userId || username;
      if (!token) throw new Error('The server did not return a valid login session.');
      sessionSet(SESSION_TOKEN_KEY, token);
      sessionSet(SESSION_USER_KEY, String(userId || ''));
      html.dataset.authGatewayState = 'authenticated';
      await activateAuthenticatedRuntime(submit);
    } catch (error) {
      clearSession();
      setSignInError(error?.message || 'Could not sign in.');
      setButtonBusy(submit, false, 'Sign in');
      html.dataset.authGatewayState = 'signed-out';
      showOnly(getSignIn(), false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const submit = form?.querySelector('button[type="submit"]');
    setButtonBusy(submit, true, 'Creating account…');
    setSignInError('');
    try {
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
      if (!payload.userId || !payload.companyCode || !payload.name || !payload.position || !payload.password) throw new Error('Complete all required registration fields.');
      if (payload.password.length < 8) throw new Error('Use a password with at least 8 characters.');
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
      showOnly(getSignIn(), true);
      setSignInError(result?.message || 'Account created. A Developer must approve it before you can sign in.');
    } catch (error) {
      const status = document.getElementById('registerZariStatus');
      if (status) status.textContent = error?.message || 'Could not create account.';
      else setSignInError(error?.message || 'Could not create account.');
    } finally {
      setButtonBusy(submit, false, 'Create account');
    }
  };

  const bindGatewayForms = () => {
    if (gatewayBound) return;
    gatewayBound = true;
    const signIn = getSignIn();
    const register = getRegister();
    document.getElementById('controlSignInForm')?.addEventListener('submit', handleLogin, { capture: true });
    document.getElementById('controlRegisterForm')?.addEventListener('submit', handleRegister, { capture: true });
    document.getElementById('openRegisterUser')?.addEventListener('click', (event) => { event.preventDefault(); showOnly(register, true); }, { capture: true });
    document.getElementById('backToSignIn')?.addEventListener('click', (event) => { event.preventDefault(); showOnly(signIn, true); }, { capture: true });
    document.getElementById('controlSignInId')?.addEventListener('input', () => {
      const input = document.getElementById('controlSignInId');
      const role = document.getElementById('controlSignInRole');
      if (input && role && input.value.trim().toLowerCase() === 'dvp') role.value = 'Developer';
    });
    document.getElementById('registerUserType')?.addEventListener('change', () => {
      const role = document.getElementById('registerUserType')?.value || 'Employee';
      const position = document.getElementById('registerPosition');
      if (position) position.placeholder = role === 'Administrator' ? 'Country Director / CEO / Country Partner / Managing Director' : 'Your role';
    });
  };

  const validateStoredSessionAndStart = async () => {
    const token = sessionGet(SESSION_TOKEN_KEY);
    bindGatewayForms();
    if (!token) {
      html.dataset.authGatewayState = 'signed-out';
      showOnly(getSignIn(), false);
      return;
    }
    html.dataset.authGatewayState = 'validating-session';
    hideAuthGate();
    try {
      await rpc('assurance_regent_browser_session_status', { p_token: token }, 5000);
      await activateAuthenticatedRuntime();
    } catch (error) {
      clearSession();
      setSignInError('Your saved session could not be verified. Please sign in again.');
      html.dataset.authGatewayState = 'signed-out';
      showOnly(getSignIn(), false);
    }
  };

  const legacyReloadFallback = () => location.reload();
  void legacyReloadFallback;

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
      const runtimeDormant = !document.querySelector('script[type="' + RUNTIME_TYPE + '"][data-runtime-loaded="true"]') && html.dataset.fullRuntimeStarted !== 'true';
      const initialHit = Boolean(signIn?.hasAttribute('open')) && controls.every(hit);
      document.getElementById('openRegisterUser')?.click();
      const signupSwitch = Boolean(register?.hasAttribute('open')) && !signIn?.hasAttribute('open');
      document.getElementById('backToSignIn')?.click();
      const backSwitch = Boolean(signIn?.hasAttribute('open')) && !register?.hasAttribute('open');
      const pass = initialHit && signupSwitch && backSwitch && runtimeDormant && html.dataset.authEntryInteractive === 'ready';
      document.body.dataset.authSmoke = pass ? 'pass' : 'fail';
      document.body.dataset.authSmokeHitTargets = String(initialHit);
      document.body.dataset.authSmokeSignup = String(signupSwitch);
      document.body.dataset.authSmokeBack = String(backSwitch);
      document.body.dataset.authSmokeRuntimeDormant = String(runtimeDormant);
      document.body.dataset.authSmokeHeartbeat = 'alive';
    }, 700);
  };

  const start = () => {
    if (html.dataset.authEntryStarted === 'true') return;
    html.dataset.authEntryStarted = 'true';
    html.dataset.authEntryBootstrap = 'ready';
    ensureAuthInteractive();
    runSmokeProbe();
    validateStoredSessionAndStart().catch((error) => console.error('[auth-gateway] startup failed', error));
  };

  start();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureAuthInteractive, { once: true });
})();
