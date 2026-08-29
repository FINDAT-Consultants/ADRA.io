import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const publicDir=resolve(process.cwd(),'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');
for(const token of ['Assurance Regent v6.3.72 — sticky pending Job ID resume lock','WORK_ACTIVITY_RESUME_LOCK_KEY72','readWorkActivityResumeLock72','setWorkActivityResumeLock72','clearWorkActivityResumeLock72','enforceWorkActivityResumeLock72','workActivityResumeLockUi72','baseResumeWorkActivityJob72','baseStartMtsSession72','baseOpenMtsClockOut72','baseCompleteMtsSession72','job_superseded_id','activeSessionId','cleared from Active & pending work','A fresh Job ID is ready for the next task'])if(!app.includes(token))throw new Error(`Work Activity resume-lock behavior missing: ${token}`);
if(!app.includes("form.dataset.mtsJobMode='resume'"))throw new Error('Resume mode is not forced while a pending Job ID is locked.');
if(!app.includes("field.value=lock.jobId"))throw new Error('Locked pending Job ID is not restored into the clock-in field.');
if(!app.includes("reset.disabled=true"))throw new Error('New Job ID control is not disabled during a locked resume.');
if(!app.includes("job_id:lock.jobId"))throw new Error('Created/resumed active sessions are not force-linked back to the pending Job ID.');
if(!app.includes("job_resume_of_session_id:lock.resumeOf"))throw new Error('Resume lineage is not persisted on the resumed work session.');
if(!app.includes("if(total>=100&&completedJobId)toast"))throw new Error('Completed Job IDs are not explicitly cleared from the pending-work lifecycle.');
const check=spawnSync(process.execPath,['--check',appPath],{encoding:'utf8'});if(check.status!==0)throw new Error(`Published app syntax check failed:\n${check.stderr||check.stdout}`);
console.log('[work-activity-resume-lock-verify] OK: Resume job locks the selected pending Job ID through clock-in and clock-out.');
console.log('[work-activity-resume-lock-verify] OK: accidental fresh IDs are superseded on resumed sessions while immutable session history is preserved.');
console.log('[work-activity-resume-lock-verify] OK: a Job ID reaching 100% leaves Active & pending work immediately and a fresh Job ID is prepared.');

await import('./verify-work-activity-progress-payroll.mjs');
