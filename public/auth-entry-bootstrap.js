(() => {
  'use strict';

  const openAuthEntry = () => {
    const body = document.body;
    const dialog = document.getElementById('controlSignInDialog');
    if (!body || !dialog || !body.classList.contains('auth-required') || dialog.open) return;

    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      document.documentElement.dataset.authEntryBootstrap = 'open';
    } catch (error) {
      console.error('Could not open the Assurance Regent sign-in form.', error);
    }
  };

  const start = () => {
    document.documentElement.dataset.authEntryBootstrap = 'ready';
    openAuthEntry();
    setTimeout(openAuthEntry, 250);
    setTimeout(openAuthEntry, 1000);
    setTimeout(openAuthEntry, 2500);
  };

  // This asset is injected immediately before the main app runtime, after the
  // dialog markup. Open synchronously so authentication never depends on the
  // large application bundle completing its bootstrap.
  start();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openAuthEntry, { once: true });
  }
})();
