import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import obfuscatorModule from 'javascript-obfuscator';

const JavaScriptObfuscator = obfuscatorModule?.default ?? obfuscatorModule;
const root = process.cwd();
const publicDir = resolve(root, 'public');

if (!existsSync(publicDir)) {
  throw new Error('Expected public/ directory was not found.');
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function seedFor(file) {
  const hex = createHash('sha256').update(relative(publicDir, file)).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16) >>> 0;
}

function sriFor(file) {
  const bytes = readFileSync(file);
  return `sha384-${createHash('sha384').update(bytes).digest('base64')}`;
}

function versionFor(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
}

function stripSourceMapHints(source) {
  return source
    .replace(/^\s*\/\/#\s*sourceMappingURL=.*$/gmu, '')
    .replace(/\/\*#\s*sourceMappingURL=.*?\*\//gsu, '');
}

function ensureProtectionLoader(html, antiCopyName) {
  if (new RegExp(`\\./${antiCopyName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:\\?[^\"']*)?`, 'u').test(html)) return html;
  const loader = `  <script src="./${antiCopyName}" integrity="__AR_SRI_PENDING__" crossorigin="anonymous"></script>\n`;
  const charset = /(<meta\s+charset=["'][^"']+["']\s*\/?>(?:\r?\n)?)/iu;
  if (charset.test(html)) return html.replace(charset, `$1${loader}`);
  return html.replace(/<head>/iu, `<head>\n${loader}`);
}

function refreshScriptIntegrityAndVersion(html) {
  return html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu, (tag, fileName) => {
    const scriptPath = join(publicDir, fileName);
    if (!existsSync(scriptPath) || !statSync(scriptPath).isFile()) return tag;
    const sri = sriFor(scriptPath);
    const version = versionFor(scriptPath);
    let next = tag.replace(/\bsrc=["']\.\/[^"']+["']/iu, `src="./${fileName}?v=${version}"`);
    if (/\bintegrity=["'][^"']*["']/iu.test(next)) {
      next = next.replace(/\bintegrity=["'][^"']*["']/iu, `integrity="${sri}"`);
    } else {
      next = next.replace(/<script\b/iu, `<script integrity="${sri}"`);
    }
    if (!/\bcrossorigin=["']anonymous["']/iu.test(next)) {
      next = next.replace(/<script\b/iu, '<script crossorigin="anonymous"');
    }
    return next;
  });
}

function isCoreRuntime(file) {
  const name = basename(file);
  return /^app(?:\.|-).*\.js$/iu.test(name)
    || /^workbook-engine(?:\.|-).*\.js$/iu.test(name)
    || /^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name)
    || /^anti-copy(?:\.|-).*\.js$/iu.test(name)
    || name === 'anti-copy.js';
}

function hardenedOptions(file) {
  return {
    target: 'browser',
    compact: true,
    deadCodeInjection: false,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    identifiersPrefix: '_ar_',
    log: false,
    renameGlobals: false,
    renameProperties: false,
    selfDefending: false,
    sourceMap: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    seed: seedFor(file),
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.35,
    numbersToExpressions: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.9,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersParametersMaxCount: 3,
    stringArrayWrappersType: 'variable',
  };
}

const allFiles = walk(publicDir);
const jsFiles = allFiles.filter((file) => file.endsWith('.js'));
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
const antiCopyFile = jsFiles.find((file) => /^anti-copy(?:\.|-).*\.js$/iu.test(basename(file)) || basename(file) === 'anti-copy.js');

if (!antiCopyFile) {
  throw new Error('No anti-copy JavaScript asset exists under public/.');
}

const antiCopyName = basename(antiCopyFile);
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  writeFileSync(htmlFile, ensureProtectionLoader(html, antiCopyName), 'utf8');
}

for (const file of jsFiles) {
  const original = stripSourceMapHints(readFileSync(file, 'utf8'));
  if (!original.trim()) throw new Error(`Refusing to process empty script: ${relative(root, file)}`);

  if (isCoreRuntime(file)) {
    // Authentication, state, workbook and agent runtimes must remain byte-stable
    // apart from source-map stripping. Security is enforced through SRI, CSP,
    // same-origin delivery and the interaction/domain guard, not runtime rewriting.
    writeFileSync(file, original, 'utf8');
    console.log(`[protect] ${relative(root, file)} profile=plain-core-runtime`);
    continue;
  }

  const result = JavaScriptObfuscator.obfuscate(original, hardenedOptions(file));
  const protectedCode = stripSourceMapHints(result.getObfuscatedCode());
  if (!protectedCode.trim()) throw new Error(`Obfuscator returned empty output for ${relative(root, file)}`);
  writeFileSync(file, protectedCode, 'utf8');
  console.log(`[protect] ${relative(root, file)} profile=hardened`);
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  writeFileSync(htmlFile, refreshScriptIntegrityAndVersion(html), 'utf8');
}

console.log(`[protect] processed ${jsFiles.length} JavaScript assets, cache-busted script URLs and refreshed SRI in ${htmlFiles.length} HTML files.`);
