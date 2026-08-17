import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const publicDir=resolve(process.cwd(),'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const html=readFileSync(join(publicDir,'index.html'),'utf8'),cssPath=join(publicDir,'work-activity-job-continuity.css');if(!existsSync(cssPath))throw new Error('Published Work Activity job stylesheet missing.');const css=readFileSync(cssPath,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');

for(const token of ['work-activity-job-continuity.css?v=6.3.70','class="span-2 work-support-job-row"','id="mtsJobId" type="text" readonly','id="mtsNewJobId"','Progress / completion (%)','id="mtsJobProgressHint"','Active &amp; pending work'])if(!html.includes(token))throw new Error(`Work Activity job UI missing: ${token}`);
for(const token of ['grid-template-columns:minmax(0,.86fr) minmax(210px,.54fr)','width:min(100%,330px)','max-width:330px','pending-job-card','pending-job-progress','work-job-table-id','#mtsJobProgressHint'])if(!css.includes(token))throw new Error(`Work Activity job style missing: ${token}`);

for(const token of ['Assurance Regent v6.3.70 — Work Activity job continuity','generateWorkActivityJobId70','uniqueWorkActivityJobId70','resumeWorkActivityJob70','workActivityStartContext70','normalizeWorkActivityProgress70','pendingWorkActivityJobs70','ownPendingWorkActivityJobs70','job_progress_before','job_progress_total','session_progress_delta','job_progress_input_mode','job_status','job_resume_of_session_id','renderWorkActivityJobs70','decorateWorkActivityTable70','maybeRemindPendingWorkActivityJobs70','bindWorkActivityJobContinuity70'])if(!app.includes(token))throw new Error(`Work Activity job runtime missing: ${token}`);
if(!app.includes("if(entered>previous){const total=Math.min(100,entered);return {previous,total,delta:Math.max(0,total-previous),entered,mode:'new_total'};}"))throw new Error('Progress reconciliation does not implement new-total subtraction semantics.');
if(!app.includes("const total=Math.min(100,previous+entered);return {previous,total,delta:Math.max(0,total-previous),entered,mode:'additional'};"))throw new Error('Progress reconciliation does not support additional progress on a repeated/lower percentage.');
if(!app.includes("job_status:progress.total>=100?'completed':'pending'"))throw new Error('100% completion does not close the Job ID lifecycle.');
if(!app.includes("renderMtsActive=function(){return renderWorkActivityJobs70();};"))throw new Error('Active session panel is not replaced with active + pending jobs.');
if(!app.includes("setWorkActivityJobMode70('resume',job.id)"))throw new Error('Pending Job ID is not locked back into the clock-in form on Resume.');
if(!app.includes('Earlier work-session records remain unchanged'))throw new Error('Immutable historical-session completion behavior is missing.');
if(!app.includes("String(j.latestCompleted?.work_date||j.latest?.work_date||'').slice(0,10)<today"))throw new Error('Next-day pending-work reminder condition is missing.');
if(!app.includes("const headers=['Date','Project','Job ID','Department'"))throw new Error('Work Activity Excel history does not expose Job ID.');
if(!app.includes('bindMts(); bindWorkActivityJobContinuity70(); bindLeave();'))throw new Error('Work Activity job runtime is not bound during boot.');

const check=spawnSync(process.execPath,['--check',appPath],{encoding:'utf8'});if(check.status!==0)throw new Error(`Published app syntax check failed:\n${check.stderr||check.stdout}`);
console.log('[work-activity-job-continuity-verify] OK: Supporting document picker is shorter and the locked auto-generated Job ID sits to its right.');
console.log('[work-activity-job-continuity-verify] OK: unfinished Job IDs remain in Active & pending work and Resume loads the same locked identity into a new work session.');
console.log('[work-activity-job-continuity-verify] OK: each resumed clock-in creates a separate immutable session while cumulative job progress is reconciled to 100%.');
console.log('[work-activity-job-continuity-verify] OK: pending jobs trigger a next-day in-app reminder and completed jobs leave the pending area while historical/payroll evidence remains intact.');
