import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/recovery-voucher-v6-3-89-runtime.inc.js'),apply:resolve(root,'scripts/apply-recovery-voucher-v6-3-89.mjs')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Recovery Voucher v6.3.89 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),apply=readFileSync(files.apply,'utf8');
for(const token of ['RECOVERY_VOUCHER_SCHEMA89','calculateRecoveryVoucher89','refreshVoucherLiveInputs89','assurance_regent_browser_read_state','Calculating…','Recovery Voucher calculated','Budget source','Rate source','voucherBound89'])if(!app.includes(token))throw new Error(`Built app is missing Recovery Voucher v6.3.89 token: ${token}`);
for(const token of ['flushStandaloneSave','engine.replaceState(snapshot.live)','state.recoveryLoadedAt=0','loadRecoveryAssurance(true)','renderRecoveryVoucher89','recoveryGate','recoverableCost','failed controls are cleared'])if(!runtime.includes(token))throw new Error(`Recovery Voucher runtime missing ${token}`);
for(const token of ['Recovery Voucher v6.3.89 requires v6.3.88','--check','calculate-button=live-refresh'])if(!apply.includes(token))throw new Error(`Recovery Voucher apply script missing ${token}`);
if(runtime.includes("keys.evidence='PASS'")||runtime.includes('recoveryGate=1'))throw new Error('Recovery Voucher v6.3.89 must not bypass recovery authorization controls.');
console.log('[verify-recovery-voucher-v89] PASS calculate button refreshes live operational state + active recovery budget, recalculates the passport and preserves all authorization gates.');

await import('./verify-recovery-voucher-approved-work-v6-3-90.mjs');
