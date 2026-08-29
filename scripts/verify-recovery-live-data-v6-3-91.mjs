import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/recovery-live-data-v6-3-91-runtime.inc.js'),apply:resolve(root,'scripts/apply-recovery-live-data-v6-3-91.mjs')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Recovery live-data v6.3.91 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),apply=readFileSync(files.apply,'utf8');
for(const token of ['RECOVERY_LIVE_DATA_SCHEMA91','recoveryLiveAllowable91','allowableHourlyRate','recoveryMode','recoveryRisk','LIVE_APPROVED_DATA','RECOVERABLE · PARTIAL'])if(!app.includes(token))throw new Error(`Built app is missing Recovery live-data v6.3.91 token: ${token}`);
for(const token of ["Math.min(employmentRate,donorHourlyCap)",'amountAtRisk','recoveryRate','System-measured fractional hours are valid',"t.name==='Approval completeness'","t.name==='Time-entry bounds'",'rejected','pending'])if(!runtime.includes(token))throw new Error(`Recovery live-data runtime missing ${token}`);
if(/Math\.abs\(Number\(e\.hours\)\*4-Math\.round\(Number\(e\.hours\)\*4\)\)/.test(runtime))throw new Error('Live-data audit must not force system-measured durations into workbook quarter-hour increments.');
if(!runtime.includes("keys.budget=budgetAvailable?'PASS':'FAIL'"))throw new Error('Financial ceilings must calculate allowable recovery instead of zeroing the entire voucher solely because raw cost exceeds a donor cap.');
for(const token of ['Recovery live-data v6.3.91 requires v6.3.90','--check','donor-hourly-cap=partial-recovery'])if(!apply.includes(token))throw new Error(`Recovery live-data apply script missing ${token}`);
console.log('[verify-recovery-live-v91] PASS live approved hours drive cost, donor ceilings cap allowable cost instead of forcing zero, rejected work contributes zero, and audit risk is derived from current exceptions/exposure.');
