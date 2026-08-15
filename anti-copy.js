(() => {
  'use strict';

  const host = String(location.hostname || '').toLowerCase();
  const authorisedHost = host === 'ar-intel.netlify.app'
    || host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('--ar-intel.netlify.app');

  if (!authorisedHost) {
    try { window.stop(); } catch (_) {}
    document.documentElement.innerHTML = '<head><title>Assurance Regent System</title></head><body style="margin:0;font-family:system-ui;background:#081b27;color:#fff;display:grid;place-items:center;min-height:100vh"><main style="max-width:640px;padding:32px;text-align:center"><h1>Assurance Regent</h1><p>This protected production build is licensed for the authorised Assurance Regent domain.</p></main></body>';
    throw new Error('Assurance Regent protected-domain check failed.');
  }

  const editable = (target) => {
    const element = target instanceof Element ? target : target?.parentElement;
    return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  };

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    return false;
  };

  document.addEventListener('contextmenu', (event) => {
    if (!editable(event.target)) stop(event);
  }, { capture: true });

  document.addEventListener('copy', (event) => {
    if (!editable(event.target)) stop(event);
  }, { capture: true });

  document.addEventListener('cut', (event) => {
    if (!editable(event.target)) stop(event);
  }, { capture: true });

  document.addEventListener('selectstart', (event) => {
    if (!editable(event.target)) stop(event);
  }, { capture: true });

  document.addEventListener('dragstart', (event) => {
    if (!editable(event.target)) stop(event);
  }, { capture: true });

  const blockedKey = (event) => {
    const key = String(event.key || '').toLowerCase();
    const mod = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;
    const devtools = key === 'f12'
      || (mod && shift && ['i', 'j', 'c', 'k'].includes(key))
      || (mod && alt && ['i', 'j', 'c'].includes(key));
    const browserExtraction = mod && ['u', 's', 'p'].includes(key);
    const saveAs = mod && shift && key === 's';
    if (devtools || browserExtraction || saveAs) return stop(event);
    return true;
  };

  window.addEventListener('keydown', blockedKey, { capture: true });
  document.addEventListener('keydown', blockedKey, { capture: true });

  const style = document.createElement('style');
  style.setAttribute('data-ar-protection', 'interaction');
  style.textContent = `
    html, body, body * { -webkit-user-select: none; user-select: none; }
    input, textarea, select, [contenteditable="true"], [contenteditable=""] { -webkit-user-select: text; user-select: text; }
    img, svg { -webkit-user-drag: none; user-drag: none; }
  `;
  (document.head || document.documentElement).appendChild(style);

  try {
    Object.defineProperty(window, '__AR_PROTECTED_BUILD__', {
      value: '6.3.19-protected',
      configurable: false,
      writable: false,
      enumerable: false,
    });
  } catch (_) {}
})();
