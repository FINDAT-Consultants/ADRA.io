  /* Assurance Regent v6.3.74 — active Job ID self-heal + reliable clock-out START */
  let workActivityClockOutBound74=false;
  function workActivityRepairContext74(row={}){
    const pending=(pendingWorkActivityJobs70?.()||[]).filter(job=>String(job.employee_id||'')===String(row.employee_id||'')&&String(job.project_code||'')===String(row.project_code||''));
    if(pending.length===1){const job=pending[0];return {jobId:job.id,progress:job.progress,iteration:job.sessions.length+1,createdAt:job.first?.job_created_at||job.first?.created_at||row.created_at||row.clock_in_at,resumeOf:job.latestCompleted?.id||job.latest?.id||'',source:'pending'};}
    const field=$('mtsJobId'),form=$('mtsClockInForm'),candidate=String(field?.value||'').trim(),used=new Set((state.mtsSessions||[]).map(workActivityJobId70).filter(Boolean));
    if(candidate&&form?.dataset.mtsJobMode!=='resume'&&!used.has(candidate))return {jobId:candidate,progress:0,iteration:1,createdAt:row.created_at||row.clock_in_at||new Date().toISOString(),resumeOf:'',source:'prepared'};
    return {jobId:uniqueWorkActivityJobId70(),progress:0,iteration:1,createdAt:row.created_at||row.clock_in_at||new Date().toISOString(),resumeOf:'',source:'generated'};
  }
  function repairOneActiveWorkActivityJob74(row={}){
    if(!row?.id||!['active','rework_required'].includes(row.status)||workActivityJobId70(row))return {row,changed:false,source:''};
    const context=workActivityRepairContext74(row),repaired=repairActiveWorkActivityJob71(row,context)||row,jobId=workActivityJobId70(repaired);
    if(jobId&&context.source==='prepared'&&$('mtsJobId')?.value.trim()===context.jobId)setWorkActivityJobMode70('new');
    return {row:repaired,changed:Boolean(jobId),source:context.source};
  }
  function repairActiveWorkActivityJobs74(){
    const repairedIds=[];let changed=false;
    for(const row of [...(state.mtsSessions||[])]){const result=repairOneActiveWorkActivityJob74(row);if(result.changed){changed=true;repairedIds.push(String(row.id));}}
    if(changed)flushWorkActivityState71().catch(err=>reportClientIncident?.('work-activity-active-job-repair',err?.message||String(err),{},'HIGH'));
    return repairedIds;
  }
  function markRepairedActiveCards74(ids=[]){
    const set=new Set(ids.map(String));if(!set.size||!$('mtsActiveSession'))return;for(const button of $('mtsActiveSession').querySelectorAll('[data-mts-clockout]'))if(set.has(String(button.dataset.mtsClockout||'')))button.closest('.active-session-card')?.setAttribute('data-work-job-repaired','true');
  }

  const baseRenderMtsActive74=renderMtsActive;
  renderMtsActive=function(){const repaired=repairActiveWorkActivityJobs74(),result=baseRenderMtsActive74();markRepairedActiveCards74(repaired);return result;};

  const baseOpenMtsClockOut74=openMtsClockOut;
  openMtsClockOut=function(id){
    let row=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(!row){toast('The active work session could not be found. Refresh Work Activity Hub and try again.');return;}
    if(!workActivityJobId70(row)){row=repairOneActiveWorkActivityJob74(row).row;flushWorkActivityState71().catch(()=>{});}
    if(!workActivityJobId70(row)){toast('A Job ID could not be attached to this active work session. Please refresh and try again.');return;}
    try{return baseOpenMtsClockOut74(id);}catch(err){reportClientIncident?.('work-activity-clockout-open',err?.message||String(err),{session_id:String(id),job_id:workActivityJobId70(row)},'HIGH');toast(err?.message||'Could not open clock-out.');}
  };

  const baseCompleteMtsSession74=completeMtsSession;
  completeMtsSession=async function(){
    const id=$('mtsClockOutId')?.value||'',row=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(row&&!workActivityJobId70(row)){repairOneActiveWorkActivityJob74(row);await flushWorkActivityState71();}
    return baseCompleteMtsSession74();
  };

  function bindWorkActivityClockOut74(){
    if(workActivityClockOutBound74)return;workActivityClockOutBound74=true;
    document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-mts-clockout]');if(!button)return;event.preventDefault();event.stopImmediatePropagation();openMtsClockOut(button.dataset.mtsClockout);},true);
  }
  bindWorkActivityClockOut74();
  setTimeout(async()=>{try{await loadMtsData();const repaired=repairActiveWorkActivityJobs74();if(repaired.length){await flushWorkActivityState71();if(state.view==='work'){baseRenderMtsActive74();renderMtsTable();}}}catch(err){reportClientIncident?.('work-activity-active-job-boot-repair',err?.message||String(err),{},'HIGH');}},0);
  /* Assurance Regent v6.3.74 — active Job ID self-heal + reliable clock-out END */
