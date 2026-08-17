import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');
for(const token of ['Assurance Regent v6.3.75 — Work Activity table column integrity','workActivityTableHeaderKey75','workActivityTableColumnIndexes75','repairWorkActivityIndividualColumns75','baseRenderMtsTable75',"clockOut:find('clock-out','clockout')","progress:find('progress')","totalHours:find('total-hours','hours')","hourlyRate:find('hourly-rate')","operationalCost:find('operational-cost')"])if(!app.includes(token))throw new Error(`Work Activity v6.3.75 behavior missing: ${token}`);
if(!app.includes("cells[indexes.clockOut].innerHTML=canClock?"))throw new Error('Clock-Out column is not restored from the actual clock-out state.');
if(!app.includes('formatTime(row.clock_out_at)'))throw new Error('Completed Work Activity rows do not render their actual clock-out time.');
if(!app.includes("cells[indexes.progress].innerHTML=workActivityProgressMarkup73(row)"))throw new Error('Progress bar is not constrained to the Progress column.');
if(!app.includes("cells[indexes.totalHours].innerHTML=finished?num(row.duration_hours,2):'—'"))throw new Error('Total Hours column is not restored after Job ID insertion.');
if(!app.includes("cells[indexes.hourlyRate].innerHTML=workActivityRateMarkup73(row)"))throw new Error('Hourly rate is not aligned to its named column.');
if(!app.includes("cells[indexes.operationalCost].innerHTML=finished?workActivityCostMarkup73(row):'—'"))throw new Error('Operational cost is not aligned to its named column.');
for(const forbidden of ['cells[6].innerHTML=workActivityProgressMarkup73(row)','cells[10].innerHTML=workActivityRateMarkup73(row)',"cells[11].innerHTML=['completed','rework_required'].includes(row.status)?workActivityCostMarkup73(row):'—'"])if(app.includes(forbidden))throw new Error(`Regression: stale hard-coded Work Activity column write remains: ${forbidden}`);
const runtime=readFileSync(resolve(root,'scripts/work-activity-table-columns-v6-3-75-runtime.inc.js'),'utf8');if(/cells\[6\]\.innerHTML=workActivityProgressMarkup73/u.test(runtime))throw new Error('Regression: v6.3.75 must never write progress into the old Clock-Out index.');
const apply=readFileSync(resolve(root,'scripts/apply-work-activity-table-columns.mjs'),'utf8');if(!apply.includes('Clock-Out progress regression still exists'))throw new Error('Build-time Clock-Out regression guard is missing.');
const check=spawnSync(process.execPath,['--check',appPath],{encoding:'utf8'});if(check.status!==0)throw new Error(`Published app syntax check failed:\n${check.stderr||check.stdout}`);
console.log('[work-activity-table-columns-verify] OK: Clock-Out contains time/action only and cannot receive progress markup.');
console.log('[work-activity-table-columns-verify] OK: Progress renders only in Progress; hours/rate/cost follow their named headers.');
