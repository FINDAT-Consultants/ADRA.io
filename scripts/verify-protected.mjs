import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { join, relative, resolve } from 'node:path';

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

if (!existsSync(publicDir)) {
  throw new Error('Expected public/ directory was not found.');
}

const files = walk(publicDir);
const jsFiles = files.filter((file) => file.endsWith('.js'));
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const sourceMaps = files.filter((file) => file.endsWith('.map'));

if (sourceMaps.length) {
  failures.push(`Source maps must not be published: ${sourceMaps.map((file) => relative(root, file)).join(', ')}`);
}

for (const file of jsFiles) {
  const code = readFileSync(file, 'utf8');
  if (/sourceMappingURL/iu.test(code)) failures.push(`${relative(root, file)} still contains a source-map reference.`);
  try {
    new vm.Script(code, { filename: relative(root, file) });
  } catch (error) {
    failures.push(`${relative(root, file)} is not valid classic-browser JavaScript: ${error.message}`);
  }
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  if (!/src=["']\.\/anti-copy(?:\.|-)[^"']*\.js["']/iu.test(html) && !/src=["']\.\/anti-copy\.js["']/iu.test(html)) {
    failures.push(`${relative(root, htmlFile)} is missing the protection loader.`);
  }

  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+\.js)["'][^>]*><\/script>/giu)) {
    const [tag, fileName] = match;
    const scriptPath = join(publicDir, fileName);
    if (!existsSync(scriptPath)) {
      failures.push(`${relative(root, htmlFile)} references missing script ${fileName}.`);
      continue;
    }
    const expected = sriFor(scriptPath);
    const integrity = tag.match(/\bintegrity=["']([^"']+)["']/iu)?.[1];
    if (integrity !== expected) failures.push(`${relative(root, htmlFile)} has an invalid SRI hash for ${fileName}.`);
    if (!/\bcrossorigin=["']anonymous["']/iu.test(tag)) failures.push(`${relative(root, htmlFile)} is missing crossorigin="anonymous" for ${fileName}.`);
  }
}

if (failures.length) {
  console.error('[verify:protected] FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[verify:protected] OK: ${jsFiles.length} JavaScript assets, ${htmlFiles.length} HTML files, no source maps, valid SRI.`);
