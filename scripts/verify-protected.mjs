import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { basename, join, relative, resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const failures = [];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function sriFor(file) {
  return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
}

function versionFor(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
}

if (!existsSync(publicDir)) throw new Error('Expected public/ directory was not found.');

const files = walk(publicDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const sourceMaps = files.filter((file) => file.endsWith('.map'));
const careersFiles = jsFiles.filter((file) => /^careers(?:\.|-).*\.js$/iu.test(basename(file)));

if (sourceMaps.length) failures.push(`Source maps must not be published: ${sourceMaps.map((file) => relative(root, file)).join(', ')}`);
if (careersFiles.length !== 1) failures.push(`Expected exactly one public careers runtime, found ${careersFiles.length}.`);

for (const file of jsFiles) {
  const code = readFileSync(file, 'utf8');
  if (/sourceMappingURL/iu.test(code)) failures.push(`${relative(root, file)} still contains a source-map reference.`);
  try { new vm.Script(code, { filename: relative(root, file) }); }
  catch (error) { failures.push(`${relative(root, file)} is not valid classic-browser JavaScript: ${error.message}`); }
  if (careersFiles.includes(file)) {
    if (/_ar_[A-Za-z0-9_$]+/u.test(code)) failures.push(`${relative(root, file)} was obfuscated even though the public vacancy/application runtime must remain stable.`);
    if (!code.includes("call('list_vacancies'")) failures.push(`${relative(root, file)} no longer contains the public vacancy loader.`);
    if (!code.includes("/functions/v1/recruitment-public")) failures.push(`${relative(root, file)} no longer targets the public recruitment service.`);
    if (!code.includes('function render()')) failures.push(`${relative(root, file)} no longer contains the vacancy renderer.`);
  }
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  if (!/src=["']\.\/anti-copy(?:\.|-)[^"'?]*\.js\?v=[a-f0-9]{16}["']/iu.test(html) && !/src=["']\.\/anti-copy\.js\?v=[a-f0-9]{16}["']/iu.test(html)) failures.push(`${relative(root, htmlFile)} is missing the versioned protection loader.`);

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)\?v=([a-f0-9]{16})["'][^>]*><\/script>/giu)) {
    const [tag, fileName, version] = match;
    const scriptPath = join(publicDir, fileName);
    if (!existsSync(scriptPath)) { failures.push(`${relative(root, htmlFile)} references missing script ${fileName}.`); continue; }
    const integrity = tag.match(/\bintegrity=["']([^"']+)["']/iu)?.[1];
    if (integrity !== sriFor(scriptPath)) failures.push(`${relative(root, htmlFile)} has an invalid SRI hash for ${fileName}.`);
    if (version !== versionFor(scriptPath)) failures.push(`${relative(root, htmlFile)} has a stale cache-busting version for ${fileName}.`);
    if (!/\bcrossorigin=["']anonymous["']/iu.test(tag)) failures.push(`${relative(root, htmlFile)} is missing crossorigin="anonymous" for ${fileName}.`);
  }

  const unversioned = [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)["'][^>]*><\/script>/giu)];
  if (unversioned.length) failures.push(`${relative(root, htmlFile)} contains unversioned JavaScript URLs: ${unversioned.map((m) => m[1]).join(', ')}`);

  /* v6.3.108 — verify the browser can accept every final stylesheet. Legacy
     module ?v= release numbers remain untouched; the main hashed stylesheet is
     additionally content-versioned to force a fresh load after this repair. */
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const tag = match[0];
    if (!/\brel=["']stylesheet["']/iu.test(tag)) continue;
    const href = tag.match(/\bhref=["']\.\/([^"'?]+\.css)(?:\?([^"']*))?["']/iu);
    if (!href) continue;
    const [, fileName, query = ''] = href;
    const stylePath = join(publicDir, fileName);
    if (!existsSync(stylePath)) { failures.push(`${relative(root, htmlFile)} references missing stylesheet ${fileName}.`); continue; }
    const integrity = tag.match(/\bintegrity=["']([^"']+)["']/iu)?.[1];
    if (integrity !== sriFor(stylePath)) failures.push(`${relative(root, htmlFile)} has an invalid stylesheet SRI hash for ${fileName}.`);
    if (!/\bcrossorigin=["']anonymous["']/iu.test(tag)) failures.push(`${relative(root, htmlFile)} is missing crossorigin="anonymous" for stylesheet ${fileName}.`);
    if (/^styles(?:\.|-).*\.css$/iu.test(fileName)) {
      const version = new URLSearchParams(query).get('v') || '';
      if (version !== versionFor(stylePath)) failures.push(`${relative(root, htmlFile)} has a stale main stylesheet cache version for ${fileName}.`);
    }
  }
}

if (failures.length) {
  console.error('[verify:protected] FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[verify:protected] OK: ${jsFiles.length} JavaScript assets, ${cssFiles.length} CSS assets, ${htmlFiles.length} HTML files, public careers runtime stable, no source maps, valid final script/CSS SRI, main stylesheet content-versioned.`);
await import('./verify-recruitment-selections-visible-v6-3-107.mjs');
await import('./verify-company-country-holidays-v6-3-109.mjs');
await import('./verify-developer-company-master-edit-v6-3-110.mjs');
await import('./verify-developer-company-profile-unlock-v6-3-111.mjs');
await import('./verify-developer-company-country-dropdown-v6-3-112.mjs');
