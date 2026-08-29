  /* Assurance Regent v6.3.72 — sticky pending Job ID resume lock START */
  const WORK_ACTIVITY_RESUME_LOCK_KEY72='assurance-regent-work-resume-lock-v6372';
  function workActivityResumeLockKey72(){return `${WORK_ACTIVITY_RESUME_LOCK_KEY72}:${String(previewSessionUserId||'user').toLowerCase()}:${String(currentCompanyId?.()||'company').toLowerCase()}`;}
  function readWorkActivityResumeLock72(){
    try{const raw=sessionGet(workActivityResumeLockKey72());if(!raw)return null;const lock=JSON.parse(raw);return lock&&String(lock.jobId||'').trim()?lock:null;}catch{return null;}
  }
  function writeWorkActivityResumeLock72(lock=null){
    const key=workActivityResumeLockKey72();if(!lock){sessionSet(key,'');return null;}const next={...lock,jobId:String(lock.jobId||'').trim(),updatedAt:new Date().toISOString()};sessionSet(key,JSON.stringify(next));return next;
  }
  function workActivityResumeJob72(jobId){const id=String(jobId||'').trim();return id?workActivityJobSummary70(id):null;}
  function workActivityResumeLockUi72(lock=null){
    const form=$('mtsClockInForm'),field=$('mtsJobId'),reset=$('mtsNewJobId'),note=document.querySelector('.work-job-id-note');
    if(lock?.jobId&&form&&field){form.dataset.mtsJobMode='resume';form.dataset.mtsJobResumeLock=lock.jobId;field.value=lock.jobId;field.readOnly=true;field.setAttribute('aria-readonly','true');field.dataset.jobMode='resume';if(reset){reset.disabled=true;reset.setAttribute('aria-disabled','true');reset.title='This Job ID is locked until the resumed work session is clocked out.';}if(note)note.innerHTML=`<b>Resuming ${esc(lock.jobId)}.</b> This Job ID is locked through clock-out so the resumed work cannot split into a new job.`;return;}
    if(form)delete form.dataset.mtsJobResumeLock;if(reset){reset.disabled=false;reset.removeAttribute('aria-disabled');reset.removeAttribute('title');}if(note)note.innerHTML='<b>Auto-generated and locked.</b> Pending jobs reuse this ID through Resume job. <button type="button" id="mtsNewJobId" class="job-id-reset-button">New job ID</button>';
  }
  function setWorkActivityResumeLock72(jobId){
    const job=workActivityResumeJob72(jobId);if(!job||job.progress>=100||job.active)return null;const latest=job.latestCompleted||job.latest||job.first||{};
    const lock=writeWorkActivityResumeLock72({jobId:job.id,employeeId:job.employee_id||latest.employee_id||'',projectCode:job.project_code||latest.project_code||'',progress:job.progress,iteration:job.sessions.length+1,jobCreatedAt:job.first?.job_created_at||job.first?.created_at||job.first?.clock_in_at||new Date().toISOString(),resumeOf:job.latestCompleted?.id||job.latest?.id||'',activeSessionId:''});workActivityResumeLockUi72(lock);return lock;
  }
  function clearWorkActivityResumeLock72(prepareFresh=true){
    writeWorkActivityResumeLock72(null);const form=$('mtsClockInForm');if(form){delete form.dataset.mtsJobResumeLock;form.dataset.mtsJobMode='new';}if(prepareFresh)setWorkActivityJobMode70('new');workActivityResumeLockUi72(null);const reset=$('mtsNewJobId');if(reset&&!reset.dataset.resumeLockRebound){reset.dataset.resumeLockRebound='true';reset.addEventListener('click',newWorkActivityJob70);}return null;
  }
  function enforceWorkActivityResumeLock72(lock=readWorkActivityResumeLock72()){
    if(!lock?.jobId)return null;const job=workActivityResumeJob72(lock.jobId);
    if(job?.progress>=100){clearWorkActivityResumeLock72(true);return null;}
    if(lock.activeSessionId){const row=(state.mtsSessions||[]).find(x=>String(x.id)===String(lock.activeSessionId));if(row&&['active','rework_required'].includes(row.status)){
      const priorId=workActivityJobId70(row);if(priorId!==lock.jobId)persistWorkActivityJobPatch71(row.id,{job_id:lock.jobId,job_iteration:Math.max(2,Number(lock.iteration||row.job_iteration||2)),job_progress_before:Number(lock.progress||0),job_progress_total:Number(lock.progress||0),session_progress_delta:0,job_progress_input:0,job_progress_input_mode:'clock_in_baseline',job_status:'active',job_created_at:lock.jobCreatedAt||row.job_created_at||row.created_at||row.clock_in_at,job_resume_of_session_id:lock.resumeOf||row.job_resume_of_session_id||'',job_superseded_id:priorId&&priorId!==lock.jobId?priorId:(row.job_superseded_id||''),job_updated_at:new Date().toISOString()});
      workActivityResumeLockUi72(lock);return lock;
    }}
    if(job&&!job.active){workActivityResumeLockUi72(lock);return lock;}
    return lock;
  }

  const baseResumeWorkActivityJob72=resumeWorkActivityJob70;
  resumeWorkActivityJob70=function(jobId){
    const id=String(jobId||'').trim();baseResumeWorkActivityJob72(id);const form=$('mtsClockInForm'),field=$('mtsJobId');if(form?.dataset.mtsJobMode==='resume'&&String(field?.value||'').trim()===id){const lock=setWorkActivityResumeLock72(id);if(lock)toast(`${id} is locked for the next clock-in. It will remain the same Job ID through clock-out.`);}
  };

  const baseBindWorkActivityJobContinuity72=bindWorkActivityJobContinuity70;
  bindWorkActivityJobContinuity70=function(){baseBindWorkActivityJobContinuity72();setTimeout(()=>{const lock=enforceWorkActivityResumeLock72();if(lock?.activeSessionId)flushWorkActivityState71().catch(()=>{});},0);};

  const baseStartMtsSession72=startMtsSession;
  startMtsSession=async function(){
    let lock=readWorkActivityResumeLock72();if(lock?.jobId){const job=workActivityResumeJob72(lock.jobId);if(!job||job.progress>=100){clearWorkActivityResumeLock72(true);lock=null;}else{workActivityResumeLockUi72(lock);if($('mtsEmployee')&&!$('mtsEmployee').value&&lock.employeeId)$('mtsEmployee').value=lock.employeeId;if($('mtsProject')&&!$('mtsProject').value&&lock.projectCode)$('mtsProject').value=lock.projectCode;}}
    const before=new Set((state.mtsSessions||[]).map(x=>String(x.id)));await baseStartMtsSession72();await loadMtsData();if(!lock?.jobId)return;
    const created=[...(state.mtsSessions||[])].filter(x=>!before.has(String(x.id))&&['active','rework_required'].includes(x.status)&&(!lock.employeeId||String(x.employee_id||'')===String(lock.employeeId))).sort((a,b)=>String(b.clock_in_at||'').localeCompare(String(a.clock_in_at||'')))[0];if(!created)return;
    const original=workActivityResumeJob72(lock.jobId),priorId=workActivityJobId70(created);persistWorkActivityJobPatch71(created.id,{job_id:lock.jobId,job_iteration:Math.max(2,Number(lock.iteration||original?.sessions?.length+1||2)),job_progress_before:Number(lock.progress??original?.progress??0),job_progress_total:Number(lock.progress??original?.progress??0),session_progress_delta:0,job_progress_input:0,job_progress_input_mode:'clock_in_baseline',job_status:'active',job_created_at:lock.jobCreatedAt||original?.first?.job_created_at||original?.first?.created_at||created.created_at||created.clock_in_at,job_resume_of_session_id:lock.resumeOf||original?.latestCompleted?.id||original?.latest?.id||'',job_superseded_id:priorId&&priorId!==lock.jobId?priorId:(created.job_superseded_id||''),job_updated_at:new Date().toISOString()});
    lock=writeWorkActivityResumeLock72({...lock,activeSessionId:created.id,iteration:Math.max(2,Number(lock.iteration||original?.sessions?.length+1||2))});workActivityResumeLockUi72(lock);await flushWorkActivityState71();await renderMts();
  };

  const baseOpenMtsClockOut72=openMtsClockOut;
  openMtsClockOut=function(id){
    const lock=readWorkActivityResumeLock72();if(lock?.jobId&&(!lock.activeSessionId||String(lock.activeSessionId)===String(id))){const row=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(row&&workActivityJobId70(row)!==lock.jobId){const priorId=workActivityJobId70(row);persistWorkActivityJobPatch71(row.id,{job_id:lock.jobId,job_iteration:Math.max(2,Number(lock.iteration||row.job_iteration||2)),job_progress_before:Number(lock.progress||0),job_progress_total:Number(lock.progress||0),job_status:'active',job_created_at:lock.jobCreatedAt||row.job_created_at||row.created_at||row.clock_in_at,job_resume_of_session_id:lock.resumeOf||row.job_resume_of_session_id||'',job_superseded_id:priorId&&priorId!==lock.jobId?priorId:(row.job_superseded_id||''),job_updated_at:new Date().toISOString()});flushWorkActivityState71().catch(()=>{});}}
    return baseOpenMtsClockOut72(id);
  };

  const baseCompleteMtsSession72=completeMtsSession;
  completeMtsSession=async function(){
    const id=$('mtsClockOutId')?.value||'',lock=readWorkActivityResumeLock72();if(lock?.jobId&&(!lock.activeSessionId||String(lock.activeSessionId)===String(id))){const row=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(row&&workActivityJobId70(row)!==lock.jobId){const priorId=workActivityJobId70(row);persistWorkActivityJobPatch71(row.id,{job_id:lock.jobId,job_iteration:Math.max(2,Number(lock.iteration||row.job_iteration||2)),job_progress_before:Number(lock.progress||0),job_progress_total:Number(lock.progress||0),job_status:'active',job_created_at:lock.jobCreatedAt||row.job_created_at||row.created_at||row.clock_in_at,job_resume_of_session_id:lock.resumeOf||row.job_resume_of_session_id||'',job_superseded_id:priorId&&priorId!==lock.jobId?priorId:(row.job_superseded_id||''),job_updated_at:new Date().toISOString()});state.mtsSessions=localMtsStore().sessions;}}
    await baseCompleteMtsSession72();await loadMtsData();const completed=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(!completed||completed.status!=='completed')return;
    const total=Math.max(0,Math.min(100,Number(completed.job_progress_total??completed.completion_percent??0)||0)),completedJobId=workActivityJobId70(completed);clearWorkActivityResumeLock72(true);await renderMts();if(total>=100&&completedJobId)toast(`${completedJobId} is complete and has been cleared from Active & pending work. A fresh Job ID is ready for the next task.`);
  };
  /* Assurance Regent v6.3.72 — sticky pending Job ID resume lock END */
