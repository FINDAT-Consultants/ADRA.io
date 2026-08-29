import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/recovery-voucher-v6-3-89-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Recovery Voucher v6.3.89 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.89 — Recovery Voucher live refresh \+ calculation START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.89 — Recovery Voucher live refresh \+ calculation END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.88 — budget maker/checker/approver workflow + notifications END */';
    if(!source.includes(anchor))throw new Error(`Recovery Voucher v6.3.89 requires v6.3.88 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECOVERY_VOUCHER_SCHEMA89','calculateRecoveryVoucher89','refreshVoucherLiveInputs89','assurance_regent_browser_read_state','Calculating…','Recovery Voucher calculated','voucherBound89','Budget source','Rate source'])if(!source.includes(token))throw new Error(`Recovery Voucher v6.3.89 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Recovery Voucher v6.3.89 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[recovery-voucher-v89] calculate-button=live-refresh recovery-bundle=forced active-budget=refreshed controls=preserved');

await import('./apply-recovery-voucher-approved-work-v6-3-90.mjs');
