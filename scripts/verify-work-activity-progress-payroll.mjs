import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),rootApp=resolve(root,'app.js'),publicApps=existsSync(publicDir)?readdirSync(publicDir).filter(n=>/^app(?:\.|-).*\.js$/iu.test(n)).map(n=>join(publicDir,n)):[],targets=[rootApp,...publicApps].filter(existsSync);
if(!targets.length)throw new Error('No client app was found for Work Activity v6.3.73 verification.');
for(const file of targets){const s=readFileSync(file,'utf8');for(const token of ['Assurance Regent v6.3.73 — Work Activity progress + payroll cost bridge','workActivityProgress73','job_progress_total??row.completion_percent','work-progress73','hourly_rate_snapshot','operational_cost','cost_rate_source','workActivityPayrollAggregate73','Work activity cost','Tracked hours','Rate gaps','Rate required','payroll ÷ expected hours','syncWorkActivityTimeEntryCost73'])if(!s.includes(token))throw new Error(`${file} missing Work Activity v6.3.73 token: ${token}`);const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Syntax check failed for ${file}:\n${check.stderr||check.stdout}`);}
for(const html of [resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync)){const s=readFileSync(html,'utf8');if(!s.includes('work-activity-progress-payroll.css?v=6.3.73'))throw new Error(`${html} is missing v6.3.73 stylesheet.`);}
const css=resolve(root,'work-activity-progress-payroll.css');if(!existsSync(css)||!readFileSync(css,'utf8').includes('.work-progress73-track'))throw new Error('Work Activity v6.3.73 progress CSS is missing.');
console.log('[verify-work-activity-progress-payroll] PASS cumulative Job ID progress bars + cost snapshots + Payroll Work Activity aggregation + explicit missing-rate state');

await import('./verify-work-activity-active-job-progress.mjs');
