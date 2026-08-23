(() => {
  'use strict';

  const AUTH_DIALOG_IDS = new Set(['controlSignInDialog', 'controlRegisterDialog']);
  const INTERACTIVE_SELECTOR = 'form,input,select,button,textarea,label,a';
  let repairQueued = false;

  const ensureInteractionStyle = () => {
    if (document.getElementById('authEntryInteractionGuardStyle')) return;
    const style = document.createElement('style');
    style.id = 'authEntryInteractionGuardStyle';
    style.textContent = [
      'body.auth-required dialog.auth-entry-dialog[open]{pointer-events:auto!important;z-index:2147483647!important}',
      'body.auth-required dialog.auth-entry-dialog[open] form,body.auth-required dialog.auth-entry-dialog[open] input,body.auth-required dialog.auth-entry-dialog[open] select,body.auth-required dialog.auth-entry-dialog[open] button,body.auth-required dialog.auth-entry-dialog[open] textarea,body.auth-required dialog.auth-entry-dialog[open] label,body.auth-required dialog.auth-entry-dialog[open] a{pointer-events:auto!important}',
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  };

  const closeDialogSafely = (dialog) => {
    if (!dialog || !dialog.open) return;
    try {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    } catch (_) {
      dialog.removeAttribute('open');
    }
  };

  const closeCompetingTopLayer = (activeAuthDialog) => {
    document.querySelectorAll('dialog[open]').forEach((dialog) => {
      if (dialog === activeAuthDialog || AUTH_DIALOG_IDS.has(dialog.id)) return;
      closeDialogSafely(dialog);
    });

    document.querySelectorAll('[popover]').forEach((popover) => {
      try {
        if (typeof popover.matches === 'function' && popover.matches(':popover-open') && typeof popover.hidePopover === 'function') {
          popover.hidePopover();
        }
      } catch (_) {
        // Older browsers may not support :popover-open; the modal auth dialog
        // still remains protected by the top-layer and pointer-event guard.
      }
    });
  };

  const normalizeAuthInteraction = (dialog) => {
    if (!dialog) return;
    if (dialog.hasAttribute('inert')) dialog.removeAttribute('inert');
    if (dialog.style.pointerEvents === 'none') dialog.style.pointerEvents = 'auto';

    dialog.querySelectorAll(INTERACTIVE_SELECTOR).forEach((element) => {
      if (element.hasAttribute('inert')) element.removeAttribute('inert');
      if (element.style.pointerEvents === 'none') element.style.pointerEvents = 'auto';
    });
  };

  const showAuthDialog = (dialog) => {
    if (!dialog || dialog.open) return;
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } catch (_) {
      dialog.setAttribute('open', '');
    }
  };

  const ensureAuthInteractive = () => {
    const body = document.body;
    if (!body || !body.classList.contains('auth-required')) return;

    ensureInteractionStyle();

    const signIn = document.getElementById('controlSignInDialog');
    const register = document.getElementById('controlRegisterDialog');
    if (!signIn) return;

    // Registration, when intentionally opened by the user, remains the active
    // authentication surface. Otherwise sign-in is the default auth surface.
    const activeAuthDialog = register && register.open ? register : signIn;

    // Remove any later non-auth modal/popover that could sit above the visible
    // authentication surface and consume pointer/keyboard events.
    closeCompetingTopLayer(activeAuthDialog);

    normalizeAuthInteraction(signIn);
    normalizeAuthInteraction(register);
    showAuthDialog(activeAuthDialog);
    normalizeAuthInteraction(activeAuthDialog);

    document.documentElement.dataset.authEntryBootstrap = 'open';
    document.documentElement.dataset.authEntryInteractive = 'ready';
  };

  const queueRepair = () => {
    if (repairQueued) return;
    repairQueued = true;
    queueMicrotask(() => {
      repairQueued = false;
      ensureAuthInteractive();
    });
  };

  const start = () => {
    document.documentElement.dataset.authEntryBootstrap = 'ready';
    ensureAuthInteractive();
    setTimeout(ensureAuthInteractive, 100);
    setTimeout(ensureAuthInteractive, 350);
    setTimeout(ensureAuthInteractive, 1000);
    setTimeout(ensureAuthInteractive, 2500);

    const observer = new MutationObserver(queueRepair);
    observer.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'inert', 'class'],
    });
  };

  // This asset is injected immediately before the main app runtime, after the
  // dialog markup. Run synchronously so authentication is usable before the
  // large application bundle can create any competing runtime layer.
  start();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAuthInteractive, { once: true });
  }
})();
