import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
const bootstrapPath = resolve(publicDir, 'auth-entry-bootstrap.js');

if (!existsSync(indexPath)) throw new Error('Published public/index.html is missing.');

const bootstrap = `(() => {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
`;

writeFileSync(bootstrapPath, bootstrap, 'utf8');

const version = createHash('sha256').update(bootstrap).digest('hex').slice(0, 16);
const integrity = `sha384-${createHash('sha384').update(bootstrap).digest('base64')}`;
const tag = `  <script src="./auth-entry-bootstrap.js?v=${version}" integrity="${integrity}" crossorigin="anonymous"></script>\n`;

let html = readFileSync(indexPath, 'utf8');
if (!/<dialog\b[^>]*\bid=["']controlSignInDialog["']/iu.test(html)) {
  throw new Error('Published sign-in dialog is missing.');
}

html = html.replace(
  /\s*<script\b[^>]*\bsrc=["']\.\/auth-entry-bootstrap\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/giu,
  '\n',
);

const appTag = /<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
if (!appTag.test(html)) throw new Error('Published application runtime tag is missing.');
html = html.replace(appTag, (match) => `${tag}${match}`);

writeFileSync(indexPath, html, 'utf8');
console.log(`[auth-entry-bootstrap] published independent login fallback v=${version}.`);
