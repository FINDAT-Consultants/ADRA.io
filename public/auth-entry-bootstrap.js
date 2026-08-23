(() => {
  'use strict';

  const SIGN_IN_ID = 'controlSignInDialog';
  const REGISTER_ID = 'controlRegisterDialog';
  const AUTH_IDS = new Set([SIGN_IN_ID, REGISTER_ID]);
  const html = document.documentElement;
  const DialogProto = typeof HTMLDialogElement === 'undefined' ? null : HTMLDialogElement.prototype;
  const nativeShowModal = DialogProto?.showModal;
  const nativeShow = DialogProto?.show;
  const nativeClose = DialogProto?.close;

  const getSignIn = () => document.getElementById(SIGN_IN_ID);
  const getRegister = () => document.getElementById(REGISTER_ID);
  const authRequired = () => Boolean(document.body?.classList.contains('auth-required'));

  const setAttr = (element, name, value = '') => {
    if (!element) return;
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };

  const removeAttr = (element, name) => {
    if (element?.hasAttribute(name)) element.removeAttribute(name);
  };

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

  const enableEntryControls = () => {
    const controls = [
      document.getElementById('controlSignInRole'),
      document.getElementById('controlSignInId'),
      document.getElementById('controlSignInPassword'),
      document.getElementById('openRegisterUser'),
      document.querySelector('#controlSignInForm button[type="submit"]'),
      document.getElementById('backToSignIn'),
    ];
    controls.forEach((control) => {
      if (!control) return;
      control.disabled = false;
      removeAttr(control, 'inert');
    });
  };

  const suppressCompetingTopLayers = () => {
    if (!authRequired()) return;
    document.querySelectorAll('dialog[open]').forEach((dialog) => {
      if (AUTH_IDS.has(dialog.id)) return;
      try {
        if (nativeClose) nativeClose.call(dialog);
        else removeAttr(dialog, 'open');
      } catch (_) {
        removeAttr(dialog, 'open');
      }
    });
    document.querySelectorAll('[popover]').forEach((popover) => {
      try {
        if (popover.matches(':popover-open') && typeof popover.hidePopover === 'function') popover.hidePopover();
      } catch (_) {}
    });
  };

  const showOnly = (dialog, focus = false) => {
    if (!dialog || !document.body) return;
    document.body.classList.add('auth-required');
    removeAttr(html, 'inert');
    removeAttr(document.body, 'inert');

    const signIn = getSignIn();
    const register = getRegister();
    if (dialog === signIn) {
      rawClose(register);
      rawOpen(signIn);
    } else if (dialog === register) {
      rawClose(signIn);
      rawOpen(register);
    } else {
      return;
    }

    suppressCompetingTopLayers();
    ensureBackdrop();
    enableEntryControls();
    html.dataset.authEntryBootstrap = 'open';
    html.dataset.authEntryInteractive = 'ready';

    if (focus) {
      const target = dialog.querySelector('select:not([disabled]),input:not([disabled]),button:not([disabled])');
      requestAnimationFrame(() => target?.focus({ preventScroll: true }));
    }
  };

  const installDialogAdapter = (dialog) => {
    if (!dialog || dialog.dataset.authEntryAdapter === 'fixed-layer') return;
    dialog.classList.add('auth-entry-dialog');

    // Remove the auth surface from the browser's native dialog top layer once.
    // From this point onward it behaves as a normal fixed element, so invisible
    // native modal/backdrop ownership cannot steal mouse or keyboard input.
    try {
      if (dialog.hasAttribute('open') && nativeClose) nativeClose.call(dialog);
    } catch (_) {
      removeAttr(dialog, 'open');
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

  const installGlobalDialogGate = () => {
    if (!DialogProto || DialogProto.__assuranceRegentAuthGate127) return;

    if (nativeShowModal) {
      DialogProto.showModal = function (...args) {
        if (authRequired() && !AUTH_IDS.has(this.id)) {
          rawClose(this);
          this.dataset.authSuppressed = 'true';
          return;
        }
        return nativeShowModal.apply(this, args);
      };
    }

    if (nativeShow) {
      DialogProto.show = function (...args) {
        if (authRequired() && !AUTH_IDS.has(this.id)) {
          rawClose(this);
          this.dataset.authSuppressed = 'true';
          return;
        }
        return nativeShow.apply(this, args);
      };
    }

    Object.defineProperty(DialogProto, '__assuranceRegentAuthGate127', {
      value: true,
      configurable: true,
    });
  };

  const ensureAuthInteractive = () => {
    const signIn = getSignIn();
    const register = getRegister();
    if (!signIn || !register) return;

    installDialogAdapter(signIn);
    installDialogAdapter(register);
    installGlobalDialogGate();

    if (!authRequired()) {
      document.getElementById('authEntryBackdrop')?.remove();
      return;
    }

    removeAttr(html, 'inert');
    removeAttr(document.body, 'inert');
    suppressCompetingTopLayers();
    enableEntryControls();

    // Preserve whichever auth surface is already selected. Otherwise default
    // to Sign in. This is idempotent: no attribute is written if unchanged.
    if (register.hasAttribute('open')) showOnly(register, false);
    else showOnly(signIn, false);
  };

  const bindEntryControls = () => {
    const signIn = getSignIn();
    const register = getRegister();
    const signInForm = document.getElementById('controlSignInForm');
    const registerForm = document.getElementById('controlRegisterForm');
    const openRegister = document.getElementById('openRegisterUser');
    const backToSignIn = document.getElementById('backToSignIn');

    // Prevent method=dialog from closing authentication before the async app.js
    // handler completes. Propagation remains intact; app.js owns Supabase auth.
    [signInForm, registerForm].forEach((form) => {
      form?.addEventListener('submit', (event) => event.preventDefault(), { capture: true });
    });

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
  };

  // Authentication markup is above this script. Install synchronously before
  // the large app runtime executes. There is deliberately NO MutationObserver
  // and NO repeating repair timer: the previous feedback loop could starve all
  // pointer/keyboard events while leaving the form visibly rendered.
  start();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAuthInteractive, { once: true });
  }
  window.addEventListener('assurance-regent-session-ended', () => setTimeout(ensureAuthInteractive, 0));
  window.addEventListener('assurance-regent-session-ready', () => {
    document.getElementById('authEntryBackdrop')?.remove();
  });
})();
