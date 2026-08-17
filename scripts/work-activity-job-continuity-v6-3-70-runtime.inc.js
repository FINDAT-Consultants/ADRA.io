  /* Assurance Regent v6.3.70 — Work Activity job continuity START */
  const WORK_ACTIVITY_JOB_REMINDER_KEY70='assurance-regent-work-job-reminder-v6370';
  function workActivityLocalDate70(value=new Date()){
    const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function workActivityJobId70(row={}){return String(row.job_id||row.jobId||'').trim();}
  function generateWorkActivityJobId70(){
    const d=new Date(),day=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const bytes=new Uint8Array(5);try{crypto.getRandomValues(bytes);}catch{for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);}
    const token=[...bytes].map(x=>x.toString(36).padStart(2,'0')).join('').toUpperCase().slice(0,8);
    return `JOB-${day}-${token}`;
  }
  function uniqueWorkActivityJobId70(){let id=generateWorkActivityJobId70(),seen=new Set((state.mtsSessions||[]).map(workActivityJobId70).filter(Boolean));for(let i=0;i<8&&seen.has(id);i++)id=generateWorkActivityJobId70();return id;}
  function scopedWorkActivityRows70(){try{return scopeMtsRows(state.mtsSessions||[]);}catch{return [...(state.mtsSessions||[])];}}
  function workActivityJobSummaries70(rows=scopedWorkActivityRows70()){
    const grouped=new Map();
    for(const row of rows||[]){const id=workActivityJobId70(row);if(!id)continue;if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(row);}
    return [...grouped.entries()].map(([id,sessions])=>{
      sessions=[...sessions].sort((a,b)=>String(a.clock_in_at||a.created_at||'').localeCompare(String(b.clock_in_at||b.created_at||'')));
      const completed=sessions.filter(x=>x.status==='completed'),latest=sessions[sessions.length-1]||null,latestCompleted=completed[completed.length-1]||null,active=[...sessions].reverse().find(x=>['active','rework_required'].includes(x.status))||null,first=sessions[0]||null;
      const progress=Math.max(0,Math.min(100,Number(latestCompleted?.job_progress_total??latestCompleted?.completion_percent??active?.job_progress_before??0)||0));
      return {id,sessions,completed,latest,latestCompleted,active,first,progress,iteration:Math.max(1,...sessions.map(x=>Number(x.job_iteration||0))),employee_id:latest?.employee_id||first?.employee_id||'',employee_name:latest?.employee_name||first?.employee_name||'',department:latest?.department||first?.department||'',project_code:latest?.project_code||first?.project_code||'',completedAt:progress>=100?(latestCompleted?.clock_out_at||latestCompleted?.updated_at||''):''};
    });
  }
  function workActivityJobSummary70(jobId){const id=String(jobId||'').trim();return workActivityJobSummaries70((state.mtsSessions||[])).find(x=>x.id===id)||null;}
  function pendingWorkActivityJobs70(){return workActivityJobSummaries70().filter(x=>x.progress<100&&!x.active).sort((a,b)=>String(b.latestCompleted?.clock_out_at||b.latest?.updated_at||'').localeCompare(String(a.latestCompleted?.clock_out_at||a.latest?.updated_at||'')));}
  function ownPendingWorkActivityJobs70(){
    const u=controlUser?.()||{},ids=new Set([u.id,u.employeeId,u.employee_id,u.name,u.email].filter(Boolean).map(x=>String(x).trim().toLowerCase()));
    if(!ids.size)return [];
    return pendingWorkActivityJobs70().filter(j=>[j.employee_id,j.employee_name].filter(Boolean).some(v=>ids.has(String(v).trim().toLowerCase())));
  }
  function setWorkActivityJobMode70(mode='new',jobId=''){
    const form=$('mtsClockInForm'),field=$('mtsJobId');if(!form||!field)return '';
    const next=String(jobId||'').trim()||uniqueWorkActivityJobId70();form.dataset.mtsJobMode=mode==='resume'?'resume':'new';field.value=next;field.readOnly=true;field.setAttribute('aria-readonly','true');field.dataset.jobMode=form.dataset.mtsJobMode;return next;
  }
  function ensureWorkActivityJobId70(){const form=$('mtsClockInForm'),field=$('mtsJobId');if(!form||!field)return '';if(form.dataset.mtsJobMode==='resume'&&field.value.trim())return field.value.trim();if(!field.value.trim())return setWorkActivityJobMode70('new');return field.value.trim();}
  function newWorkActivityJob70(){setWorkActivityJobMode70('new');if($('mtsActivity'))$('mtsActivity').value='';if($('mtsDocument'))$('mtsDocument').value='';$('mtsActivity')?.focus();}
  function resumeWorkActivityJob70(jobId){
    const job=workActivityJobSummary70(jobId);if(!job)return toast('This pending Job ID could not be found.');if(job.progress>=100)return toast(`${job.id} is already complete.`);if(job.active)return toast(`${job.id} already has an active work session.`);
    const row=job.latestCompleted||job.latest;if(!row)return toast('The pending job has no recoverable work record.');
    if($('mtsEmployee'))$('mtsEmployee').value=row.employee_id||'';if($('mtsEmployeeName'))$('mtsEmployeeName').value=row.employee_name||'';if($('mtsDepartment')&&row.department)$('mtsDepartment').value=row.department;if($('mtsProject'))$('mtsProject').value=row.project_code||'';if($('mtsActivity'))$('mtsActivity').value='';if($('mtsDocument'))$('mtsDocument').value='';
    setWorkActivityJobMode70('resume',job.id);toast(`${job.id} loaded at ${num(job.progress,0)}% completion. Add today's activity description and clock in.`);$('mtsClockInForm')?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('mtsActivity')?.focus(),260);
  }
  function workActivityStartContext70(employeeId,projectCode){
    const field=$('mtsJobId'),form=$('mtsClockInForm'),jobId=String(ensureWorkActivityJobId70()||'').trim();if(!jobId)throw new Error('A Job ID could not be generated.');
    if(form?.dataset.mtsJobMode==='resume'){
      const job=workActivityJobSummary70(jobId);if(!job)throw new Error('The selected pending Job ID no longer exists.');if(job.progress>=100)throw new Error(`${jobId} has already reached 100% completion.`);if(job.active)throw new Error(`${jobId} already has an active work session.`);
      if(employeeId&&job.employee_id&&String(employeeId).trim().toLowerCase()!==String(job.employee_id).trim().toLowerCase())throw new Error(`Job ${jobId} belongs to ${job.employee_name||job.employee_id}; restore that employee before clocking in.`);
      if(projectCode&&job.project_code&&String(projectCode).trim()!==String(job.project_code).trim())throw new Error(`Job ${jobId} is locked to project ${job.project_code}.`);
      return {jobId,mode:'resume',progress:job.progress,iteration:job.sessions.length+1,createdAt:job.first?.job_created_at||job.first?.created_at||new Date().toISOString(),resumeOf:job.latestCompleted?.id||job.latest?.id||''};
    }
    if((state.mtsSessions||[]).some(x=>workActivityJobId70(x)===jobId))setWorkActivityJobMode70('new');
    return {jobId:String(field?.value||jobId),mode:'new',progress:0,iteration:1,createdAt:new Date().toISOString(),resumeOf:''};
  }
  function normalizeWorkActivityProgress70(previousValue,inputValue){
    const previous=Math.max(0,Math.min(100,Number(previousValue)||0)),entered=Number(inputValue);if(!Number.isFinite(entered)||entered<0||entered>100)throw new Error('Enter a progress percentage from 0 to 100.');
    if(previous>=100)return {previous,total:100,delta:0,entered,mode:'complete'};
    if(entered===0)return {previous,total:previous,delta:0,entered,mode:'no_change'};
    if(entered>previous){const total=Math.min(100,entered);return {previous,total,delta:Math.max(0,total-previous),entered,mode:'new_total'};}
    const total=Math.min(100,previous+entered);return {previous,total,delta:Math.max(0,total-previous),entered,mode:'additional'};
  }
  function workActivityProgressHint70(previous){
    const p=Math.max(0,Math.min(100,Number(previous)||0));
    return p?`Previous total is <strong>${num(p,0)}%</strong>. Enter a higher number to set a new overall total; enter the same or a lower positive number to add that amount as today's progress. Enter 0 for no progress.`:`This is the first session for this job. Enter the completion reached when you clock out.`;
  }
  function renderWorkActivityJobs70(){
    if(!$('mtsActiveSession'))return;
    const scoped=scopedWorkActivityRows70(),active=scoped.filter(x=>['active','rework_required'].includes(x.status)).sort((a,b)=>String(b.updated_at||b.clock_in_at||'').localeCompare(String(a.updated_at||a.clock_in_at||''))),pending=pendingWorkActivityJobs70();
    $('mtsActiveBadge').textContent=pending.length?`${active.length} active · ${pending.length} pending`:`${active.length} active`;
    if(!active.length&&!pending.length){$('mtsActiveSession').className='active-session-empty';$('mtsActiveSession').innerHTML='<span>◷</span><b>No active or pending work</b><p>Start a session to create a locked Job ID and real-time activity evidence.</p>';return;}
    $('mtsActiveSession').className='active-session-list';
    const activeHtml=active.map(x=>{const jobId=workActivityJobId70(x),baseline=Math.max(0,Math.min(100,Number(x.job_progress_before??x.job_progress_total??0)||0));return `<article class="active-session-card"><div class="active-session-top"><span class="live-dot"></span><div class="active-session-person">${userIdentity(x.employee_id,x.employee_name,x.project_code,'xs')}<small>${esc(x.department)}</small></div><button class="btn small primary" data-mts-clockout="${esc(x.id)}">${x.status==='rework_required'?'Clock Out Rework':'Clock Out'}</button></div>${jobId?`<span class="work-job-chip">${esc(jobId)}</span>`:''}${x.status==='rework_required'?'<span class="rework-chip">Document rework required</span>':''}<p>${esc(x.activity_description)}</p>${jobId?`<div class="active-job-progress"><span>Job progress before this session</span><b>${num(baseline,0)}%</b></div>`:''}<div class="active-meta"><span>Started ${formatDateTime(x.clock_in_at)}</span><span>${elapsedTaskDays(x)} day${elapsedTaskDays(x)===1?'':'s'} elapsed</span><span>${esc(shortLocation(x.clock_out_location||x.clock_in_location))}</span>${x.document_name?`<span>📎 ${esc(x.document_name)}</span>`:''}</div></article>`;}).join('');
    const today=workActivityLocalDate70(),pendingHtml=pending.map(job=>{const x=job.latestCompleted||job.latest,delta=Number(x?.session_progress_delta||0),lastDate=String(x?.work_date||'').slice(0,10),old=lastDate&&lastDate<today;return `<article class="active-session-card pending-job-card"><div class="active-session-top"><span class="pending-job-dot"></span><div class="active-session-person">${userIdentity(job.employee_id,job.employee_name,job.project_code,'xs')}<small>${esc(job.department)}</small></div><button class="btn small primary" data-mts-resume-job="${esc(job.id)}">Resume job</button></div><span class="work-job-chip">${esc(job.id)}</span><p>${esc(x?.activity_description||'Pending work')}</p><div class="pending-job-progress-head"><span>Overall completion</span><b>${num(job.progress,0)}%</b></div><div class="pending-job-progress"><span style="width:${Math.max(0,Math.min(100,job.progress))}%"></span></div><div class="active-meta"><span>Last worked ${esc(lastDate||'—')}</span>${delta>0?`<span>Last session +${num(delta,0)}%</span>`:''}<span>${job.completed.length} recorded session${job.completed.length===1?'':'s'}</span><span>${esc(shortLocation(x?.clock_out_location||x?.clock_in_location||''))}</span></div>${old?'<span class="pending-job-reminder">◷ Pending from an earlier work day</span>':''}</article>`;}).join('');
    $('mtsActiveSession').innerHTML=activeHtml+pendingHtml;$('mtsActiveSession').querySelectorAll('[data-mts-clockout]').forEach(b=>b.addEventListener('click',()=>openMtsClockOut(b.dataset.mtsClockout)));$('mtsActiveSession').querySelectorAll('[data-mts-resume-job]').forEach(b=>b.addEventListener('click',()=>resumeWorkActivityJob70(b.dataset.mtsResumeJob)));
    maybeRemindPendingWorkActivityJobs70();
  }
  function decorateWorkActivityTable70(){
    if(state.mtsMode!=='individual'||!$('mtsTable'))return;const table=$('mtsTable'),head=table.querySelector('thead tr'),bodyRows=[...table.querySelectorAll('tbody tr')];if(!head)return;
    if(![...head.children].some(th=>th.dataset.workJobHeader==='true')){const th=document.createElement('th');th.textContent='Job ID';th.dataset.workJobHeader='true';head.children[1]?.after(th);}
    const ordered=filteredMtsSessions().sort((a,b)=>String(b.clock_in_at||'').localeCompare(String(a.clock_in_at||'')));
    bodyRows.forEach((tr,i)=>{if(tr.classList.contains('empty-row')){tr.querySelector('td')?.setAttribute('colspan','17');return;}if(tr.querySelector('[data-work-job-cell]'))return;const row=ordered[i];if(!row)return;const td=document.createElement('td');td.dataset.workJobCell='true';const id=workActivityJobId70(row);td.innerHTML=id?`<span class="work-job-table-id" title="${esc(id)}">${esc(id)}</span>`:'—';tr.children[1]?.after(td);const progressCell=tr.children[7],delta=Number(row.session_progress_delta||0);if(progressCell&&delta>0){const label=progressCell.querySelector('.progress-label');if(label&&!label.querySelector('.job-progress-delta'))label.insertAdjacentHTML('beforeend',` <span class="job-progress-delta">+${num(delta,0)}% job</span>`);}});
  }
  function maybeRemindPendingWorkActivityJobs70(){
    if(!state.control?.profile?.signedIn)return;const today=workActivityLocalDate70(),jobs=ownPendingWorkActivityJobs70().filter(j=>String(j.latestCompleted?.work_date||j.latest?.work_date||'').slice(0,10)<today);if(!jobs.length)return;
    const key=`${WORK_ACTIVITY_JOB_REMINDER_KEY70}:${String(previewSessionUserId||'user')}:${currentCompanyId?.()||''}:${today}`,fingerprint=jobs.map(j=>j.id).sort().join('|');if(localGet(key)===fingerprint)return;localSet(key,fingerprint);
    const first=jobs[0],extra=jobs.length-1;toast(extra?`Pending work reminder: ${first.id} is at ${num(first.progress,0)}%, plus ${extra} more unfinished job${extra===1?'':'s'}.`:`Pending work reminder: ${first.id} is at ${num(first.progress,0)}%. Resume it in Work Activity Hub.`);
  }
  function bindWorkActivityJobContinuity70(){
    ensureWorkActivityJobId70();$('mtsNewJobId')?.addEventListener('click',newWorkActivityJob70);window.addEventListener('focus',maybeRemindPendingWorkActivityJobs70);document.addEventListener('visibilitychange',()=>{if(!document.hidden)maybeRemindPendingWorkActivityJobs70();});
  }

  const baseStartMtsSession70=startMtsSession;
  startMtsSession=async function(){
    const employeeId=$('mtsEmployee')?.value.trim()||'',project=$('mtsProject')?.value.trim()||'';let context;try{context=workActivityStartContext70(employeeId,project);}catch(err){toast(err.message||String(err));return;}
    const before=new Set((state.mtsSessions||[]).map(x=>String(x.id)));await baseStartMtsSession70();await loadMtsData();
    const created=[...(state.mtsSessions||[])].filter(x=>!before.has(String(x.id))&&['active','rework_required'].includes(x.status)&&String(x.employee_id||'')===employeeId).sort((a,b)=>String(b.clock_in_at||'').localeCompare(String(a.clock_in_at||'')))[0];if(!created)return;
    const store=localMtsStore(),idx=store.sessions.findIndex(x=>String(x.id)===String(created.id));if(idx<0)return;const current=store.sessions[idx];store.sessions[idx]={...current,job_id:context.jobId,job_iteration:context.iteration,job_progress_before:context.progress,job_progress_total:context.progress,session_progress_delta:0,job_progress_input:0,job_progress_input_mode:'clock_in_baseline',job_status:'active',job_created_at:context.createdAt,job_resume_of_session_id:context.resumeOf||'',job_updated_at:new Date().toISOString()};saveLocalMtsStore(store);state.mtsSessions=store.sessions;setWorkActivityJobMode70('new');await renderMts();
  };

  const baseOpenMtsClockOut70=openMtsClockOut;
  openMtsClockOut=function(id){
    baseOpenMtsClockOut70(id);const row=state.mtsSessions.find(x=>String(x.id)===String(id));if(!row)return;const jobId=workActivityJobId70(row),previous=Math.max(0,Math.min(100,Number(row.job_progress_before??0)||0)),input=$('mtsCompletion');if(input){input.value='';input.placeholder=previous?`Previous ${num(previous,0)}% — enter next progress`:'e.g. 20, 50 or 100';input.required=true;const label=input.closest('label');if(label){let hint=$('mtsJobProgressHint');if(!hint){hint=document.createElement('small');hint.id='mtsJobProgressHint';label.appendChild(hint);}hint.innerHTML=workActivityProgressHint70(previous);}}
    if(jobId&&$('mtsClockOutSummary')&&!$('mtsClockOutSummary').querySelector('[data-clockout-job-id]'))$('mtsClockOutSummary').insertAdjacentHTML('beforeend',`<div data-clockout-job-id><small>Job ID</small><b>${esc(jobId)}</b></div><div><small>Progress before session</small><b>${num(previous,0)}%</b></div>`);
  };

  const baseCompleteMtsSession70=completeMtsSession;
  completeMtsSession=async function(){
    const id=$('mtsClockOutId')?.value||'',row=state.mtsSessions.find(x=>String(x.id)===String(id));if(!row)return baseCompleteMtsSession70();const raw=String($('mtsCompletion')?.value??'').trim();if(raw===''){toast('Enter the progress reached for this Job ID before clocking out.');$('mtsCompletion')?.focus();return;}
    const jobId=workActivityJobId70(row)||uniqueWorkActivityJobId70(),previous=Math.max(0,Math.min(100,Number(row.job_progress_before??0)||0));let progress;try{progress=normalizeWorkActivityProgress70(previous,Number(raw));}catch(err){toast(err.message||String(err));$('mtsCompletion')?.focus();return;}$('mtsCompletion').value=String(progress.total);
    await baseCompleteMtsSession70();await loadMtsData();const completed=state.mtsSessions.find(x=>String(x.id)===String(id));if(!completed||completed.status!=='completed')return;const store=localMtsStore(),idx=store.sessions.findIndex(x=>String(x.id)===String(id));if(idx<0)return;const current=store.sessions[idx];store.sessions[idx]={...current,job_id:jobId,job_iteration:Number(current.job_iteration||row.job_iteration||1),job_progress_before:previous,job_progress_total:progress.total,session_progress_delta:progress.delta,job_progress_input:progress.entered,job_progress_input_mode:progress.mode,job_status:progress.total>=100?'completed':'pending',job_completed_at:progress.total>=100?(current.clock_out_at||new Date().toISOString()):'',job_updated_at:new Date().toISOString()};saveLocalMtsStore(store);state.mtsSessions=store.sessions;
    if(progress.total>=100)toast(`${jobId} reached 100% and is complete. Earlier work-session records remain unchanged.`);else toast(`${jobId} remains pending at ${num(progress.total,0)}%. This session contributed ${num(progress.delta,0)}%.`);await renderMts();refreshCurrent();
  };

  const baseRenderMtsActive70=renderMtsActive;
  renderMtsActive=function(){return renderWorkActivityJobs70();};
  const baseRenderMtsTable70=renderMtsTable;
  renderMtsTable=function(){const result=baseRenderMtsTable70();decorateWorkActivityTable70();return result;};
  const baseCompleteControlSignIn70=completeControlSignIn;
  completeControlSignIn=async function(...args){const result=await baseCompleteControlSignIn70(...args);setTimeout(maybeRemindPendingWorkActivityJobs70,180);return result;};
  /* Assurance Regent v6.3.70 — Work Activity job continuity END */
