import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

await import('./apply-developer-company-country-flags-v6-3-113.mjs');

const root=process.cwd(),publicDir=resolve(root,'public'),runtimePath=resolve(root,'scripts/developer-company-country-flags-v6-3-114-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Developer country flag runtime v6.3.114 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.114 — reliable visible country flags START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.114 — reliable visible country flags END \*\//u;
const rootApp=resolve(root,'app.js'),targets=[rootApp];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.113 — flag country picker and saved-country context END */';if(!source.includes(anchor))throw new Error(`Reliable country flags require v6.3.113 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['COMPANY_COUNTRY_FLAGS_SCHEMA114','countryFlagEmoji114','flagcdn.com/w40/','countryFlagVisual113=countryFlagVisual114','forceCustomOptions:true','visibleOptionFlags:true'])if(!source.includes(token))throw new Error(`Reliable country flag runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Reliable country flag syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);if(source!==before)writeFileSync(file,source,'utf8');
}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
const publicApps=targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile()),appNames=new Set(publicApps.map(file=>basename(file)));let sriUpdated=0;
if(existsSync(publicDir))for(const htmlFile of walk(publicDir).filter(file=>file.endsWith('.html'))){let html=readFileSync(htmlFile,'utf8'),before=html;html=html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu,(tag,fileName)=>{if(!appNames.has(fileName))return tag;const script=join(publicDir,fileName);if(!existsSync(script))return tag;const sri=sriFor(script),version=versionFor(script);let next=tag.replace(/\bsrc=["']\.\/[^"']+["']/iu,`src="./${fileName}?v=${version}"`);if(/\bintegrity=["'][^"']*["']/iu.test(next))next=next.replace(/\bintegrity=["'][^"']*["']/iu,`integrity="${sri}"`);else next=next.replace(/<script\b/iu,`<script integrity="${sri}"`);if(!/\bcrossorigin=["']anonymous["']/iu.test(next))next=next.replace(/<script\b/iu,'<script crossorigin="anonymous"');sriUpdated+=1;return next;});if(html!==before)writeFileSync(htmlFile,html,'utf8');}
if(publicApps.length&&sriUpdated<1)throw new Error(`Reliable country flag patch updated ${publicApps.length} public app runtime(s) but found no HTML app-script SRI binding to refresh.`);
console.log(`[developer-company-country-flags-v6-3-114] apps=${targets.filter(existsSync).length} visible-flags=1 custom-options=1 fallback=regional-indicator sri-bindings=${sriUpdated}`);
await import('./verify-developer-company-country-flags-v6-3-114.mjs');
