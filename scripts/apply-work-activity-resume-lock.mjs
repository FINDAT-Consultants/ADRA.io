import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtime=resolve(root,'scripts/work-activity-resume-lock-v6-3-72-runtime.inc.js');
if(!existsSync(runtime))throw new Error('Work Activity v6.3.72 resume-lock runtime is missing.');
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const addon=readFileSync(runtime,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.72 — sticky pending Job ID resume lock START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.72 — sticky pending Job ID resume lock END \*\//u;

for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;if(!s.includes('Assurance Regent v6.3.71 — reliable Job ID clock-out'))throw new Error(`v6.3.71 clock-out layer must be applied before resume lock in ${basename(file)}.`);
  if(block.test(s))s=s.replace(block,addon);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Boot anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon+'\n\n'+anchor);}
  for(const token of ['Assurance Regent v6.3.72 — sticky pending Job ID resume lock','WORK_ACTIVITY_RESUME_LOCK_KEY72','setWorkActivityResumeLock72','enforceWorkActivityResumeLock72','job_superseded_id','baseStartMtsSession72','baseCompleteMtsSession72','cleared from Active & pending work'])if(!s.includes(token))throw new Error(`Work Activity resume-lock runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Work Activity resume-lock syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[work-activity-resume-lock] ${basename(file)} sticky-resume=enabled completed-job-clear=enabled`);
}

await import('./apply-work-activity-progress-payroll.mjs');
