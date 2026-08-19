import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/recovery-voucher-approved-work-v6-3-90-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Recovery approved-work v6.3.90 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.90 — approved-work recovery \+ rejected-entry exclusion START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.90 — approved-work recovery \+ rejected-entry exclusion END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.89 — Recovery Voucher live refresh + calculation END */';
    if(!source.includes(anchor))throw new Error(`Recovery approved-work v6.3.90 requires v6.3.89 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECOVERY_APPROVED_WORK_SCHEMA90','recoveryEntryDecision90','recoverySelectedEntries90','rejected entries are excluded','APPROVED_WORK_ONLY','approvedEntryCount','pendingEntryCount'])if(!source.includes(token))throw new Error(`Recovery approved-work v6.3.90 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Recovery approved-work v6.3.90 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[recovery-approved-work-v90] rejected=excluded approved=eligible pending=blocking recovery-gate=recalculated');
