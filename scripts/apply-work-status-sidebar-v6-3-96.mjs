import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/work-status-sidebar-v6-3-96-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Work Status sidebar v6.3.96 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.96 — guaranteed Work Status sidebar START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.96 — guaranteed Work Status sidebar END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.95 — leave submit reset + dedicated Work Status END */';
    if(!source.includes(anchor))throw new Error(`Work Status sidebar v6.3.96 requires v6.3.95 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['WORK_STATUS_SIDEBAR_SCHEMA96','workStatusAllowed95=function(){return Boolean(controlUser());}','workStatusBound96','switchView(WORK_STATUS_VIEW95)','nav.hidden=!Boolean(controlUser())'])if(!source.includes(token))throw new Error(`Work Status sidebar v6.3.96 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Work Status sidebar v6.3.96 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[work-status-sidebar-v96] signed-in-users=visible dedicated-nav=guaranteed direct-click=enabled');
await import('./verify-work-status-sidebar-v6-3-96.mjs');
