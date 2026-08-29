import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const required=[
  'interface-stability-v6-3-125.css',
  'interface-stability-v6-3-125.js',
  'scripts/apply-interface-structure-v6-3-125.mjs',
  'scripts/publish-interface-stability-v6-3-125.mjs',
  'public/index.html',
  'public/interface-stability-v6-3-125.css',
  'public/interface-stability-v6-3-125.js'
];
for(const rel of required)if(!existsSync(resolve(root,rel)))throw new Error(`Missing v6.3.125 interface artifact: ${rel}`);

const css=readFileSync(resolve(root,'interface-stability-v6-3-125.css'),'utf8');
const js=readFileSync(resolve(root,'interface-stability-v6-3-125.js'),'utf8');
const publicCss=readFileSync(resolve(root,'public/interface-stability-v6-3-125.css'),'utf8');
const publicJs=readFileSync(resolve(root,'public/interface-stability-v6-3-125.js'),'utf8');
const html=readFileSync(resolve(root,'public/index.html'),'utf8');
const app=readFileSync(resolve(root,'app.js'),'utf8');

for(const token of [
  '#mtsEmployeeMonth>.user-identity',
  '#mtsEmployeeMonth>strong',
  '#mtsJobsList>div',
  '#mtsOvertimeList>.risk-row',
  '.daily-pair>article',
  '.people-summary-card{min-height:174px}',
  '.company-title-block h1',
  '.onboarding-wizard-panel',
  '.control-drawer',
  '.modal{max-height',
  '.chart-panel canvas{height:248px',
  'overflow-wrap:anywhere'
])if(!css.includes(token))throw new Error(`Interface CSS is missing ${token}`);

for(const token of [
  "const SCHEMA='6.3.125'",
  'rendererCssDriftFixes:true',
  'employeeMonthOverlapFix:true',
  'jobsAnalyticsRowFix:true',
  'dailyEvidenceMarkupFix:true',
  'dynamicClippingDiagnostics:true'
])if(!js.includes(token))throw new Error(`Interface runtime is missing ${token}`);

if(css!==publicCss)throw new Error('Published interface CSS does not match source.');
if(js!==publicJs)throw new Error('Published interface JS does not match source.');

/* The canonical renderer itself must also carry the structural repair after the apply step. */
for(const token of ['interface-analytics-row125','winner-score125','interface-daily-card125'])if(!app.includes(token))throw new Error(`Canonical app renderer is missing ${token}. Run apply-interface-structure-v6-3-125.mjs first.`);

const sha384=file=>`sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const version=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
const publicJsPath=resolve(root,'public/interface-stability-v6-3-125.js');
const publicCssPath=resolve(root,'public/interface-stability-v6-3-125.css');
if(!html.includes(`src="./interface-stability-v6-3-125.js?v=${version(publicJsPath)}"`)||!html.includes(`integrity="${sha384(publicJsPath)}"`))throw new Error('Published interface JS binding/SRI is stale.');
if(!html.includes(`href="./interface-stability-v6-3-125.css?v=${version(publicCssPath)}"`)||!html.includes(`integrity="${sha384(publicCssPath)}"`))throw new Error('Published interface CSS binding/SRI is stale.');

const countryPos=html.indexOf('country-select-v6-3-124.js');
const interfacePos=html.indexOf('interface-stability-v6-3-125.js');
if(interfacePos<0)throw new Error('Interface runtime is not loaded by public/index.html.');
if(countryPos>=0&&interfacePos<countryPos)throw new Error('Interface runtime must load after the country-selector runtime.');

console.log('[verify-interface-stability-v6-3-125] OK: renderer structure, density, wrapping, dynamic clipping diagnostics, public bytes and SRI are aligned.');
