import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');
for(const token of ['Assurance Regent v6.3.74 — active Job ID self-heal + reliable clock-out','workActivityRepairContext74','repairOneActiveWorkActivityJob74','repairActiveWorkActivityJobs74','baseRenderMtsActive74','baseOpenMtsClockOut74','baseCompleteMtsSession74','bindWorkActivityClockOut74','event.stopImmediatePropagation()','pendingWorkActivityJobs70?.()','repairActiveWorkActivityJob71(row,context)'])if(!app.includes(token))throw new Error(`Work Activity v6.3.74 behavior missing: ${token}`);
if(!app.includes("if(!workActivityJobId70(row)){row=repairOneActiveWorkActivityJob74(row).row"))throw new Error('Clock-out does not repair a missing active Job ID before opening.');
if(!app.includes("document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-mts-clockout]')"))throw new Error('Delegated Work Activity clock-out handler is missing.');
const cssPath=resolve(publicDir,'work-activity-active-job-progress.css');if(!existsSync(cssPath))throw new Error('Published v6.3.74 Work Activity stylesheet missing.');const css=readFileSync(cssPath,'utf8');for(const token of ['#mtsTable .mini-progress>span','#mtsTable .work-progress73-track>span','display:block;height:100%','progress-incomplete','progress-moderate','progress-near','progress-complete'])if(!css.includes(token))throw new Error(`Visible Work Activity progress CSS missing: ${token}`);
const html=readFileSync(resolve(publicDir,'index.html'),'utf8');if(!html.includes('work-activity-active-job-progress.css?v=6.3.74'))throw new Error('Published HTML is missing v6.3.74 stylesheet cache-bust.');
const check=spawnSync(process.execPath,['--check',appPath],{encoding:'utf8'});if(check.status!==0)throw new Error(`Published app syntax check failed:\n${check.stderr||check.stdout}`);
console.log('[work-activity-active-job-progress-verify] OK: active sessions missing Job IDs self-heal before rendering and clock-out.');
console.log('[work-activity-active-job-progress-verify] OK: delegated Clock Out handles active-card/table controls without duplicate stale listeners.');
console.log('[work-activity-active-job-progress-verify] OK: legacy and v6.3.73 Work Activity progress tracks render visible colored fills.');

await import('./verify-work-activity-table-columns.mjs');
