import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/recovery-exceptions-pagination-v6-3-93-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Recovery Exceptions pagination v6.3.93 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.93 — Recovery Exceptions five-row pagination START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.93 — Recovery Exceptions five-row pagination END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.92 — Recovery Exceptions live financial exposure END */';
    if(!source.includes(anchor))throw new Error(`Recovery Exceptions pagination v6.3.93 requires v6.3.92 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECOVERY_EXCEPTIONS_PAGINATION_SCHEMA93','RECOVERY_EXCEPTIONS_PAGE_SIZE93=5','recoveryExceptionsPager93','Exceptions ${first}–${last} of ${totalRows}','Previous exceptions page','Next exceptions page'])if(!source.includes(token))throw new Error(`Recovery Exceptions pagination v6.3.93 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Recovery Exceptions pagination v6.3.93 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[recovery-exceptions-pagination-v93] page-size=5 controls=only-after-five empty-state=preserved');

await import('./verify-recovery-exceptions-pagination-v6-3-93.mjs');
