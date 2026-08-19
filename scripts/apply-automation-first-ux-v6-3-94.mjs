import {existsSync,readFileSync,readdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/automation-first-ux-v6-3-94-runtime.inc.js'),cssSource=resolve(root,'scripts/automation-first-ux-v6-3-94.css');
if(!existsSync(runtimeFile))throw new Error('Automation-first UX v6.3.94 runtime is missing.');
if(!existsSync(cssSource))throw new Error('Automation-first UX v6.3.94 stylesheet is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.94 — automation-first role work centre START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.94 — automation-first role work centre END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.93 — Recovery Exceptions five-row pagination END */';if(!source.includes(anchor))throw new Error(`Automation-first UX v6.3.94 requires v6.3.93 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['AUTOMATION_FIRST_UX_SCHEMA94','Automation Centre','automationTasks94','automationPrefillWork94','AUTOMATION_REFRESH_MS94=60000','What needs you next','Running automatically'])if(!source.includes(token))throw new Error(`Automation-first UX v6.3.94 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Automation-first UX v6.3.94 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(existsSync(publicDir))copyFileSync(cssSource,resolve(publicDir,'automation-first-ux-v6-3-94.css'));
for(const htmlFile of [resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync)){
  let html=readFileSync(htmlFile,'utf8');
  if(!/automation-first-ux-v6-3-94\.css/u.test(html))html=html.replace(/(<link\s+rel=["']stylesheet["'][^>]*styles[^>]*>)/iu,`$1\n  <link rel="stylesheet" href="./automation-first-ux-v6-3-94.css" />`);
  writeFileSync(htmlFile,html,'utf8');
}
console.log('[automation-first-v94] role-work-centre=enabled dashboard-actions=enabled work-prefill=enabled background-refresh=60s feature-map=enabled');
await import('./verify-automation-first-ux-v6-3-94.mjs');
