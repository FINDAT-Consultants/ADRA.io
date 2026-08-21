import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

await import('./apply-calendar-holiday-labels-v6-3-115.mjs');

const root=process.cwd(),publicDir=resolve(root,'public'),runtimePath=resolve(root,'scripts/dashboard-holiday-descriptions-v6-3-116-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Dashboard holiday description runtime v6.3.116 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.116 — dashboard operational calendar holiday descriptions START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.116 — dashboard operational calendar holiday descriptions END \*\//u;
const rootApp=resolve(root,'app.js'),targets=[rootApp];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.115 — human-readable calendar holiday labels END */';if(!source.includes(anchor))throw new Error(`Dashboard holiday descriptions require v6.3.115 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['DASHBOARD_HOLIDAY_DESCRIPTIONS_SCHEMA116','1 January - Holiday: New Year','decorateDashboardHolidays116','Holiday schedule','renderDashboardCalendarBefore116','visibleSchedule:true','dayTooltips:true'])if(!source.includes(token))throw new Error(`Dashboard holiday description runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Dashboard holiday description syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);if(source!==before)writeFileSync(file,source,'utf8');
}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
const publicApps=targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile()),appNames=new Set(publicApps.map(file=>basename(file)));let sriUpdated=0;
if(existsSync(publicDir))for(const htmlFile of walk(publicDir).filter(file=>file.endsWith('.html'))){let html=readFileSync(htmlFile,'utf8'),before=html;html=html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu,(tag,fileName)=>{if(!appNames.has(fileName))return tag;const script=join(publicDir,fileName);if(!existsSync(script))return tag;const sri=sriFor(script),version=versionFor(script);let next=tag.replace(/\bsrc=["']\.\/[^"']+["']/iu,`src="./${fileName}?v=${version}"`);if(/\bintegrity=["'][^"']*["']/iu.test(next))next=next.replace(/\bintegrity=["'][^"']*["']/iu,`integrity="${sri}"`);else next=next.replace(/<script\b/iu,`<script integrity="${sri}"`);if(!/\bcrossorigin=["']anonymous["']/iu.test(next))next=next.replace(/<script\b/iu,'<script crossorigin="anonymous"');sriUpdated+=1;return next;});if(html!==before)writeFileSync(htmlFile,html,'utf8');}
if(publicApps.length&&sriUpdated<1)throw new Error(`Dashboard holiday description patch updated ${publicApps.length} public app runtime(s) but found no HTML app-script SRI binding to refresh.`);
console.log(`[dashboard-holiday-descriptions-v6-3-116] apps=${targets.filter(existsSync).length} visible-schedule=1 day-tooltips=1 format="D Month - Holiday: Name" sri-bindings=${sriUpdated}`);
await import('./verify-dashboard-holiday-descriptions-v6-3-116.mjs');
