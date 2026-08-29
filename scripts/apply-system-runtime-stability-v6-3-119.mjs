import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

await import('./apply-onboarding-completion-transfer-v6-3-118.mjs');

const root=process.cwd();
const publicDir=resolve(root,'public');
const runtimePath=resolve(root,'scripts/system-runtime-stability-v6-3-119-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('System runtime stability v6.3.119 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.119 — durable runtime state persistence START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.119 — durable runtime state persistence END \*\//u;
const anchor='  /* Assurance Regent v6.3.118 — onboarding completion transfer END */';
const rootApp=resolve(root,'app.js');
const targets=[rootApp];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));

for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8');
  const before=source;
  if(block.test(source))source=source.replace(block,runtime);
  else{
    if(!source.includes(anchor))throw new Error(`System runtime stability requires v6.3.118 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of [
    'SYSTEM_RUNTIME_STABILITY_SCHEMA119','6.3.119','criticalStateWriteFetch119',
    'Durable Supabase state save failed; snapshot retained for retry.',
    'standaloneSaveGeneration119','standaloneSaveLastError119','flushStandaloneSaveDurable119',
    'criticalStateWriteLane:true','failedSnapshotsRetained:true','boundedRetry:true',
    'authoritativeServerStateAdoption:true','onboardingActiveStateInvariant:true',
    'AssuranceRegentRuntimeStability'
  ])if(!source.includes(token))throw new Error(`System runtime stability missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(check.status!==0)throw new Error(`System runtime stability syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

const rootIndex=resolve(root,'index.html');
if(existsSync(rootIndex)){
  let html=readFileSync(rootIndex,'utf8');
  if(!/\.\/app\.js(?:\?v=[^"']*)?/u.test(html))throw new Error('Root index.html does not load app.js.');
  html=html.replace(/\.\/app\.js(?:\?v=[^"']*)?/gu,'./app.js?v=6.3.119');
  writeFileSync(rootIndex,html,'utf8');
}

function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
const publicApps=targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile());
const appNames=new Set(publicApps.map(file=>basename(file)));
let sriUpdated=0;
if(existsSync(publicDir))for(const htmlFile of walk(publicDir).filter(file=>file.endsWith('.html'))){
  let html=readFileSync(htmlFile,'utf8'),before=html;
  html=html.replace(/<script\b[^>]*\bsrc=["']\.\/([^"'?]+\.js)(?:\?[^"']*)?["'][^>]*><\/script>/giu,(tag,fileName)=>{
    if(!appNames.has(fileName))return tag;
    const script=join(publicDir,fileName);if(!existsSync(script))return tag;
    const sri=sriFor(script),version=versionFor(script);
    let next=tag.replace(/\bsrc=["']\.\/[^"']+["']/iu,`src="./${fileName}?v=${version}"`);
    if(/\bintegrity=["'][^"']*["']/iu.test(next))next=next.replace(/\bintegrity=["'][^"']*["']/iu,`integrity="${sri}"`);
    else next=next.replace(/<script\b/iu,`<script integrity="${sri}"`);
    if(!/\bcrossorigin=["']anonymous["']/iu.test(next))next=next.replace(/<script\b/iu,'<script crossorigin="anonymous"');
    sriUpdated+=1;return next;
  });
  if(html!==before)writeFileSync(htmlFile,html,'utf8');
}
if(publicApps.length&&sriUpdated<1)throw new Error(`System runtime stability updated ${publicApps.length} public app runtime(s) but found no HTML app-script SRI binding to refresh.`);
console.log(`[system-runtime-stability-v6-3-119] apps=${targets.filter(existsSync).length} durable-state=1 critical-write-lane=1 retry=1 root-cache-bust=1 sri-bindings=${sriUpdated}`);
await import('./verify-system-runtime-stability-v6-3-119.mjs');
