import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'work-activity-job-continuity.css'),runtime=resolve(root,'scripts/work-activity-job-continuity-v6-3-70-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Work Activity job continuity assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'work-activity-job-continuity.css'),readFileSync(css,'utf8'),'utf8');

const supportPattern=/<label class="span-2">Supporting document\s*<input id="mtsDocument" type="file"[^>]*\/>\s*<\/label>/u;
const newSupport='<div class="span-2 work-support-job-row"><label class="work-supporting-file">Supporting document <input id="mtsDocument" type="file" /></label><label class="work-job-id-field">Job ID<input id="mtsJobId" type="text" readonly aria-readonly="true" autocomplete="off" /><small class="work-job-id-note"><b>Auto-generated and locked.</b> Pending jobs reuse this ID through Resume job. <button type="button" id="mtsNewJobId" class="job-id-reset-button">New job ID</button></small></label></div>';
const completionPattern=/<label>Percentage of completion<input type="number" id="mtsCompletion"[^>]*\/><\/label>/u;
const newCompletion='<label>Progress / completion (%)<input type="number" id="mtsCompletion" min="0" max="100" step="1" placeholder="e.g. 20, 50 or 100" required /><small id="mtsJobProgressHint">Enter the progress reached when you clock out.</small></label>';

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/work-activity-job-continuity\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./work-activity-job-continuity.css?v=6.3.70" />';
  if(s.includes('<link rel="stylesheet" href="./department-hub-compact-reporting.css?v=6.3.43" />'))s=s.replace('<link rel="stylesheet" href="./department-hub-compact-reporting.css?v=6.3.43" />','<link rel="stylesheet" href="./department-hub-compact-reporting.css?v=6.3.43" />\n'+link);else s=s.replace('</head>',link+'\n</head>');
  if(supportPattern.test(s))s=s.replace(supportPattern,newSupport);else if(!s.includes('id="mtsJobId"'))throw new Error(`Work Activity supporting-document anchor missing in ${basename(file)}.`);
  if(completionPattern.test(s))s=s.replace(completionPattern,newCompletion);else if(!s.includes('id="mtsJobProgressHint"'))throw new Error(`Work Activity completion anchor missing in ${basename(file)}.`);
  s=s.replace('<span class="section-kicker">Live work</span><h3>Active session</h3>','<span class="section-kicker">Live work</span><h3>Active &amp; pending work</h3>');
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[work-activity-job-continuity] ${basename(file)} compact-file=enabled job-id=locked active+pending=enabled`);
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();
  const block=/  \/\* Assurance Regent v6\.3\.70 — Work Activity job continuity START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.70 — Work Activity job continuity END \*\//u;
  if(block.test(s))s=s.replace(block,addon);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Work Activity job continuity runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon+'\n\n'+anchor);}
  if(s.includes('bindMts(); bindLeave();'))s=s.replace('bindMts(); bindLeave();','bindMts(); bindWorkActivityJobContinuity70(); bindLeave();');else if(!s.includes('bindWorkActivityJobContinuity70();'))throw new Error(`Work Activity job continuity binding anchor missing in ${basename(file)}.`);

  const oldExportHeaders="const headers=['Date','Project','Department','Employee','Clock In','Clock Out','Completion','Activity','Hours','Hourly Rate','Operational Cost','Currency','Location','Comments','Document','Recovery Entry'];";
  const newExportHeaders="const headers=['Date','Project','Job ID','Department','Employee','Clock In','Clock Out','Completion','Activity','Hours','Hourly Rate','Operational Cost','Currency','Location','Comments','Document','Recovery Entry'];";
  if(s.includes(oldExportHeaders))s=s.replace(oldExportHeaders,newExportHeaders);
  const oldExportRow="const body=rows.map(x=>[x.work_date,x.project_code,x.department,x.employee_name,formatDateTime(x.clock_in_at),formatDateTime(x.clock_out_at),x.completion_percent,x.activity_description,x.duration_hours,hourlyRateFor(x.employee_id,x.project_code),hourlyCostFor(x.duration_hours,x.employee_id,x.project_code),activeCurrency(),[x.clock_in_location,x.clock_out_location].filter(Boolean).join(' → '),x.delay_comments,x.document_name,x.recovery_entry_id]);";
  const newExportRow="const body=rows.map(x=>[x.work_date,x.project_code,workActivityJobId70(x),x.department,x.employee_name,formatDateTime(x.clock_in_at),formatDateTime(x.clock_out_at),x.completion_percent,x.activity_description,x.duration_hours,hourlyRateFor(x.employee_id,x.project_code),hourlyCostFor(x.duration_hours,x.employee_id,x.project_code),activeCurrency(),[x.clock_in_location,x.clock_out_location].filter(Boolean).join(' → '),x.delay_comments,x.document_name,x.recovery_entry_id]);";
  if(s.includes(oldExportRow))s=s.replace(oldExportRow,newExportRow);

  for(const token of ['Assurance Regent v6.3.70 — Work Activity job continuity','generateWorkActivityJobId70','resumeWorkActivityJob70','normalizeWorkActivityProgress70','job_progress_before','job_progress_total','session_progress_delta','pendingWorkActivityJobs70','maybeRemindPendingWorkActivityJobs70','decorateWorkActivityTable70','bindWorkActivityJobContinuity70'])if(!s.includes(token))throw new Error(`Work Activity job continuity runtime missing ${token} in ${basename(file)}.`);
  if(!s.includes("renderMtsActive=function(){return renderWorkActivityJobs70();};"))throw new Error(`Pending-job Active session override missing in ${basename(file)}.`);
  if(!s.includes("completeMtsSession=async function()"))throw new Error(`Job-progress clock-out wrapper missing in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[work-activity-job-continuity] ${basename(file)} immutable-sessions=enabled cumulative-progress=enabled daily-reminder=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
