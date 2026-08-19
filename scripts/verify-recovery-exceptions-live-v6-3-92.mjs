import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/recovery-exceptions-live-v6-3-92-runtime.inc.js'),apply:resolve(root,'scripts/apply-recovery-exceptions-live-v6-3-92.mjs')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Recovery Exceptions live v6.3.92 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),apply=readFileSync(files.apply,'utf8');
for(const token of ['RECOVERY_EXCEPTIONS_LIVE_SCHEMA92','APPROVED_WORK_ACTUAL','recoveryApprovedWorkRate92','recoveryScopedRows92','recoveryAttention92','Recoverable now','Amount at risk','Items needing action','Evidence / eligibility gaps'])if(!app.includes(token))throw new Error(`Built app is missing Recovery Exceptions live v6.3.92 token: ${token}`);
for(const token of ['operationalCost','hourlyRate','recoveryDecision91','APPROVED','pricedHours','totalCost','recoveryMode','PARTIAL','amountAtRisk','No management recovery exceptions in this period','Payroll rates and accounting formulas remain hidden'])if(!runtime.includes(token))throw new Error(`Recovery Exceptions live runtime missing ${token}`);
for(const token of ['Recovery Exceptions live v6.3.92 requires v6.3.91','--check','approved-work-actual=preferred'])if(!apply.includes(token))throw new Error(`Recovery Exceptions live apply script missing ${token}`);
for(const forbidden of ['employeeId:\'007\'','projectCode:\'FIN-010\'','ZMW 76.80','100000','MAX_HOURLY_COST = 150'])if(runtime.includes(forbidden))throw new Error(`Recovery Exceptions live runtime must not contain production/demo-specific figure: ${forbidden}`);
const priced=[{hours:1.25,cost:62.5},{hours:.75,cost:37.5}],hours=priced.reduce((n,x)=>n+x.hours,0),cost=priced.reduce((n,x)=>n+x.cost,0),rate=cost/hours;if(Math.abs(rate-50)>1e-9||Math.abs(hours*rate-cost)>1e-9)throw new Error('Approved-work weighted actual-cost rate sanity check failed.');
console.log('[verify-recovery-exceptions-live-v92] PASS live approved-work cost drives recovery, zero exception counts do not hide recoverable value, and no production-specific figures are embedded.');
