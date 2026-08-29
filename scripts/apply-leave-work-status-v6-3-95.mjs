import {existsSync,readFileSync,readdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/leave-work-status-v6-3-95-runtime.inc.js'),cssSource=resolve(root,'scripts/leave-work-status-v6-3-95.css');
if(!existsSync(runtimeFile))throw new Error('Leave / Work Status v6.3.95 runtime is missing.');
if(!existsSync(cssSource))throw new Error('Leave / Work Status v6.3.95 stylesheet is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.95 — leave submit reset \+ dedicated Work Status START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.95 — leave submit reset \+ dedicated Work Status END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.94 — automation-first role work centre END */';if(!source.includes(anchor))throw new Error(`Leave / Work Status v6.3.95 requires v6.3.94 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['LEAVE_WORK_STATUS_SCHEMA95','WORK_STATUS_VIEW95','resetLeaveRequestForm95','Submitting…','ensureWorkStatusView95','renderWorkStatusView95','The dashboard now reflects the latest location/status.'])if(!source.includes(token))throw new Error(`Leave / Work Status v6.3.95 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Leave / Work Status v6.3.95 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(existsSync(publicDir))copyFileSync(cssSource,resolve(publicDir,'leave-work-status-v6-3-95.css'));
for(const htmlFile of [resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync)){
  let html=readFileSync(htmlFile,'utf8');
  if(!/leave-work-status-v6-3-95\.css/u.test(html))html=html.replace(/(<link\s+rel=["']stylesheet["'][^>]*automation-first-ux-v6-3-94\.css[^>]*>)/iu,`$1\n  <link rel="stylesheet" href="./leave-work-status-v6-3-95.css" />`);
  writeFileSync(htmlFile,html,'utf8');
}
console.log('[leave-work-status-v95] leave-reset=success-only work-status=dedicated-sidebar dashboard-sync=enabled');
await import('./verify-leave-work-status-v6-3-95.mjs');
await import('./apply-work-status-sidebar-v6-3-96.mjs');
