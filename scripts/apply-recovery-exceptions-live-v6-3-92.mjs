import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/recovery-exceptions-live-v6-3-92-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Recovery Exceptions live v6.3.92 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.92 — Recovery Exceptions live financial exposure START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.92 — Recovery Exceptions live financial exposure END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.91 — live-data recovery + allowable-cost risk END */';
    if(!source.includes(anchor))throw new Error(`Recovery Exceptions live v6.3.92 requires v6.3.91 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECOVERY_EXCEPTIONS_LIVE_SCHEMA92','APPROVED_WORK_ACTUAL','recoveryScopedRows92','Recoverable now','Amount at risk','Items needing action','No management recovery exceptions in this period'])if(!source.includes(token))throw new Error(`Recovery Exceptions live v6.3.92 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Recovery Exceptions live v6.3.92 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[recovery-exceptions-live-v92] approved-work-actual=preferred recoverable-value=visible amount-at-risk=visible attention=blocked+partial+failed');

await import('./verify-recovery-exceptions-live-v6-3-92.mjs');
