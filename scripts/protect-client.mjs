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

function stripSourceMapHints(source) {
  return source
    .replace(/^\s*\/\/#\s*sourceMappingURL=.*$/gmu, '')
    .replace(/\/\*#\s*sourceMappingURL=.*?\*\//gsu, '');
}

function ensureProtectionLoader(html, antiCopyName) {
  if (html.includes(`./${antiCopyName}`)) return html;
  const loader = `  <script src="./${antiCopyName}" integrity="__AR_SRI_PENDING__" crossorigin="anonymous"></script>\n`;
  const charset = /(<meta\s+charset=["'][^"']+["']\s*\/?>(?:\r?\n)?)/iu;
  if (charset.test(html)) return html.replace(charset, `$1${loader}`);
  return html.replace(/<head>/iu, `<head>\n${loader}`);
}

function refreshScriptIntegrity(html) {
  return html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"']+\.js)["'][^>]*><\/script>/giu, (tag, fileName) => {
    const scriptPath = join(publicDir, fileName);
    if (!existsSync(scriptPath) || !statSync(scriptPath).isFile()) return tag;
    const sri = sriFor(scriptPath);
    let next = tag;
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
  if (!original.trim()) throw new Error(`Refusing to obfuscate empty script: ${relative(root, file)}`);

  const result = JavaScriptObfuscator.obfuscate(original, {
    target: 'browser',
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.35,
    deadCodeInjection: false,
    debugProtection: false,
    debugProtectionInterval: 0,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    identifiersPrefix: '_ar_',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    renameProperties: false,
    selfDefending: false,
    simplify: true,
    sourceMap: false,
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
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    seed: seedFor(file),
  });

  const protectedCode = stripSourceMapHints(result.getObfuscatedCode());
  if (!protectedCode.trim()) throw new Error(`Obfuscator returned empty output for ${relative(root, file)}`);
  writeFileSync(file, protectedCode, 'utf8');
  console.log(`[protect] ${relative(root, file)}`);
}

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  writeFileSync(htmlFile, refreshScriptIntegrity(html), 'utf8');
}

console.log(`[protect] protected ${jsFiles.length} JavaScript assets and refreshed SRI in ${htmlFiles.length} HTML files.`);
