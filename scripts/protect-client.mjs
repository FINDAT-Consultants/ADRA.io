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

/* v6.3.117 — load the Dashboard holiday key as an independent runtime.
   It reads the same persisted Supabase live.calendar state as the main app and
   repairs the legend after any Dashboard redraw, so holiday names cannot be
   lost when renderDashboardCalendar() replaces the mini-calendar markup. */
function ensureDashboardHolidayKeyLoader(html, holidayKeyName) {
  if (!/id=["']dashMiniCalendar["']/iu.test(html)) return html;
  if (new RegExp(`\\./${holidayKeyName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?:\\?[^\"']*)?`, 'u').test(html)) return html;
  const loader = `  <script src="./${holidayKeyName}" integrity="__AR_SRI_PENDING__" crossorigin="anonymous"></script>\n`;
  if (/<\/body>/iu.test(html)) return html.replace(/<\/body>/iu, `${loader}</body>`);
  return `${html}\n${loader}`;
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

/* v6.3.108 — late release patchers can change published CSS after its original
   SRI was generated. Refresh the final integrity hash so browsers do not reject
   the stylesheet. Preserve fixed legacy ?v= release URLs used by existing
   module verifiers; only the main hashed Assurance Regent stylesheet receives
   a content version for an immediate cache refresh. */
function refreshStylesheetIntegrityAndVersion(html) {
  return html.replace(/<link\b[^>]*>/giu, (tag) => {
    if (!/\brel=["']stylesheet["']/iu.test(tag)) return tag;
    const href = tag.match(/\bhref=["']\.\/([^"'?]+\.css)(\?[^"']*)?["']/iu);
    if (!href) return tag;
    const fileName = href[1];
    const stylePath = join(publicDir, fileName);
    if (!existsSync(stylePath) || !statSync(stylePath).isFile()) return tag;
    const sri = sriFor(stylePath);
    let next = tag;
    if (/^styles(?:\.|-).*\.css$/iu.test(fileName)) {
      const version = versionFor(stylePath);
      next = next.replace(/\bhref=["']\.\/[^"']+["']/iu, `href="./${fileName}?v=${version}"`);
    }
    if (/\bintegrity=["'][^"']*["']/iu.test(next)) {
      next = next.replace(/\bintegrity=["'][^"']*["']/iu, `integrity="${sri}"`);
    } else {
      next = next.replace(/<link\b/iu, `<link integrity="${sri}"`);
    }
    if (!/\bcrossorigin=["']anonymous["']/iu.test(next)) {
      next = next.replace(/<link\b/iu, '<link crossorigin="anonymous"');
    }
    return next;
  });
}

function isCoreRuntime(file) {
  const name = basename(file);
  return /^app(?:\.|-).*\.js$/iu.test(name)
    || /^workbook-engine(?:\.|-).*\.js$/iu.test(name)
    || /^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name)
    || /^careers(?:\.|-).*\.js$/iu.test(name)
    || /^anti-copy(?:\.|-).*\.js$/iu.test(name)
    || name === 'anti-copy.js'
    || name === 'xlsx.full.min.js';
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
const dashboardHolidayKeyFile = jsFiles.find((file) => basename(file) === 'dashboard-holiday-key-v6-3-117.js');

if (!antiCopyFile) {
  throw new Error('No anti-copy JavaScript asset exists under public/.');
}
if (!dashboardHolidayKeyFile) {
  throw new Error('Dashboard holiday key v6.3.117 is missing from public/.');
}

const antiCopyName = basename(antiCopyFile);
const dashboardHolidayKeyName = basename(dashboardHolidayKeyFile);
for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  const withProtection = ensureProtectionLoader(html, antiCopyName);
  writeFileSync(htmlFile, ensureDashboardHolidayKeyLoader(withProtection, dashboardHolidayKeyName), 'utf8');
}

for (const file of jsFiles) {
  const original = stripSourceMapHints(readFileSync(file, 'utf8'));
  if (!original.trim()) throw new Error(`Refusing to process empty script: ${relative(root, file)}`);

  if (isCoreRuntime(file)) {
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
  const withScripts = refreshScriptIntegrityAndVersion(html);
  writeFileSync(htmlFile, refreshStylesheetIntegrityAndVersion(withScripts), 'utf8');
}

const mainHtml = htmlFiles.find((file) => /(?:^|[/\\])index\.html$/iu.test(file));
if (!mainHtml) throw new Error('Dashboard holiday key verification requires public/index.html.');
const mainHtmlSource = readFileSync(mainHtml, 'utf8');
if (!new RegExp(`src=["']\\./${dashboardHolidayKeyName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\?v=[a-f0-9]{16}["']`, 'u').test(mainHtmlSource)) {
  throw new Error('Dashboard holiday key v6.3.117 was not injected with a cache-busted script URL.');
}
if (!new RegExp(`src=["']\\./${dashboardHolidayKeyName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}[^>]*integrity=["']sha384-`, 'u').test(mainHtmlSource)
    && !new RegExp(`integrity=["']sha384-[^"']+["'][^>]*src=["']\\./${dashboardHolidayKeyName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'u').test(mainHtmlSource)) {
  throw new Error('Dashboard holiday key v6.3.117 is missing final SRI protection.');
}

console.log(`[protect] processed ${jsFiles.length} JavaScript assets, loaded dashboard holiday key v6.3.117, refreshed final script/CSS SRI, and cache-busted the main stylesheet in ${htmlFiles.length} HTML files.`);