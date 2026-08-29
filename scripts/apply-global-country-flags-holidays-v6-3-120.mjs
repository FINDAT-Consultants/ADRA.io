import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

await import('./apply-system-runtime-stability-v6-3-119.mjs');

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimePath=resolve(root,'scripts/global-country-flags-holidays-v6-3-120-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Global country flags/holidays v6.3.120 runtime is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.120 — global country flags and company holiday calendar START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.120 — global country flags and company holiday calendar END \*\//u;
const anchor='  /* Assurance Regent v6.3.119 — durable runtime state persistence END */';
const rootApp=resolve(root,'app.js'),targets=[rootApp];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{if(!source.includes(anchor))throw new Error(`v6.3.120 requires v6.3.119 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['GLOBAL_COUNTRY_HOLIDAY_SCHEMA120','countryFlagEmoji120','companyCountryOptions=function','newCompanyCountry','countryFlagEnhanceSelect113','upsertCalendarCompanyScoped120','companyMatch120','fetchGlobalCompanyHolidays120','syncGlobalCompanyHolidays120','staleSystemHolidayReconciliation:true','multipleNamesPerDate:true','yellowDotNames:true','primaryCountryCoverage:206','AssuranceRegentGlobalCountryHolidays'])if(!source.includes(token))throw new Error(`v6.3.120 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`v6.3.120 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
const rootIndex=resolve(root,'index.html');
if(existsSync(rootIndex)){let html=readFileSync(rootIndex,'utf8');if(!/\.\/app\.js(?:\?v=[^"']*)?/u.test(html))throw new Error('Root index.html does not load app.js.');html=html.replace(/\.\/app\.js(?:\?v=[^"']*)?/gu,'./app.js?v=6.3.120');writeFileSync(rootIndex,html,'utf8');}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
const publicApps=targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile()),appNames=new Set(publicApps.map(file=>basename(file)));let sriUpdated=0;
if(existsSync(publicDir))for(const htmlFile of walk(publicDir).filter(file=>file.endsWith('.html'))){let html=readFileSync(htmlFile,'utf8'),before=html;html=html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu,(tag,fileName)=>{if(!appNames.has(fileName))return tag;const script=join(publicDir,fileName);if(!existsSync(script))return tag;const sri=sriFor(script),version=versionFor(script);let next=tag.replace(/\bsrc=["']\.\/[^"']+["']/iu,`src="./${fileName}?v=${version}"`);if(/\bintegrity=["'][^"']*["']/iu.test(next))next=next.replace(/\bintegrity=["'][^"']*["']/iu,`integrity="${sri}"`);else next=next.replace(/<script\b/iu,`<script integrity="${sri}"`);if(!/\bcrossorigin=["']anonymous["']/iu.test(next))next=next.replace(/<script\b/iu,'<script crossorigin="anonymous"');sriUpdated+=1;return next;});if(html!==before)writeFileSync(htmlFile,html,'utf8');}
if(publicApps.length&&sriUpdated<1)throw new Error('v6.3.120 found no public app-script SRI binding to refresh.');
console.log(`[global-country-flags-holidays-v6-3-120] apps=${targets.filter(existsSync).length} all-country-flags=1 company-calendar-scope=1 global-holiday-engine=1 named-yellow-dots=1 sri-bindings=${sriUpdated}`);
await import('./verify-global-country-flags-holidays-v6-3-120.mjs');
