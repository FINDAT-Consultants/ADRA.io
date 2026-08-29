import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const indexPath = resolve(publicDir, 'index.html');
if (!existsSync(indexPath)) throw new Error('Published public/index.html is missing.');

const original = readFileSync(indexPath, 'utf8');
let refreshed = 0;
const updated = original.replace(
  /<script\b[^>]*\bsrc=["']\.\/(app(?:\.[^"'?]+)?\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu,
  (tag, fileName) => {
    const appPath = resolve(publicDir, fileName);
    if (!existsSync(appPath)) throw new Error(`Published application runtime is missing: public/${fileName}`);
    const bytes = readFileSync(appPath);
    const version = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const integrity = `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
    let next = tag.replace(/\bsrc=["']\.\/[^"']+["']/iu, `src="./${fileName}?v=${version}"`);
    if (/\bintegrity=["'][^"']*["']/iu.test(next)) next = next.replace(/\bintegrity=["'][^"']*["']/iu, `integrity="${integrity}"`);
    else next = next.replace(/<script\b/iu, `<script integrity="${integrity}"`);
    if (!/\bcrossorigin=["']anonymous["']/iu.test(next)) next = next.replace(/<script\b/iu, '<script crossorigin="anonymous"');
    refreshed++;
    return next;
  },
);

if (!refreshed) throw new Error('No published Assurance Regent application script was found in public/index.html.');
if (updated !== original) writeFileSync(indexPath, updated, 'utf8');
console.log(`[public-integrity] refreshed ${refreshed} application runtime reference(s) after final post-build patching.`);
