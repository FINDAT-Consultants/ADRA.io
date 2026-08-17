  /* Assurance Regent v6.3.71 — reliable Job ID clock-out START */
  async function flushWorkActivityState71(){
    for(let i=0;i<4;i++){
      await flushStandaloneSave();
      if(!standaloneSavePending&&!standaloneSaveInFlight)return;
      await sleep(120);
    }
  }
  function persistWorkActivityJobPatch71(id,patch={}){
    const store=localMtsStore(),idx=store.sessions.findIndex(x=>String(x.id)===String(id));if(idx<0)return null;
    store.sessions[idx]={...store.sessions[idx],...patch};saveLocalMtsStore(store);state.mtsSessions=store.sessions;return store.sessions[idx];
  }
  function repairActiveWorkActivityJob71(row,preferred={}){
    if(!row||!['active','rework_required'].includes(row.status))return row||null;
    if(workActivityJobId70(row))return row;
    const jobId=String(preferred.jobId||'').trim()||uniqueWorkActivityJobId70(),progress=Math.max(0,Math.min(100,Number(preferred.progress??row.job_progress_before??row.job_progress_total??0)||0)),iteration=Math.max(1,Number(preferred.iteration||row.job_iteration||1));
    return persistWorkActivityJobPatch71(row.id,{job_id:jobId,job_iteration:iteration,job_progress_before:progress,job_progress_total:progress,session_progress_delta:0,job_progress_input:0,job_progress_input_mode:'clock_in_baseline',job_status:'active',job_created_at:preferred.createdAt||row.job_created_at||row.created_at||row.clock_in_at||new Date().toISOString(),job_resume_of_session_id:preferred.resumeOf||row.job_resume_of_session_id||'',job_updated_at:new Date().toISOString()})||row;
  }
  function repairExistingActiveWorkActivityJobs71(){
    let changed=false;for(const row of state.mtsSessions||[]){if(['active','rework_required'].includes(row.status)&&!workActivityJobId70(row)){repairActiveWorkActivityJob71(row);changed=true;}}
    if(changed)flushWorkActivityState71().then(()=>renderMts()).catch(()=>{});return changed;
  }

  const baseBindWorkActivityJobContinuity71=bindWorkActivityJobContinuity70;
  bindWorkActivityJobContinuity70=function(){baseBindWorkActivityJobContinuity71();repairExistingActiveWorkActivityJobs71();};

  const baseStartMtsSession71=startMtsSession;
  startMtsSession=async function(){
    const employeeId=$('mtsEmployee')?.value.trim()||'',preferredJobId=$('mtsJobId')?.value.trim()||'',mode=$('mtsClockInForm')?.dataset.mtsJobMode||'new',resumeJob=mode==='resume'&&preferredJobId?workActivityJobSummary70(preferredJobId):null,before=new Set((state.mtsSessions||[]).map(x=>String(x.id)));
    await baseStartMtsSession71();await loadMtsData();
    const created=[...(state.mtsSessions||[])].filter(x=>!before.has(String(x.id))&&['active','rework_required'].includes(x.status)&&(!employeeId||String(x.employee_id||'')===employeeId)).sort((a,b)=>String(b.clock_in_at||'').localeCompare(String(a.clock_in_at||'')))[0];if(!created)return;
    repairActiveWorkActivityJob71(created,{jobId:preferredJobId||workActivityJobId70(created),progress:resumeJob?.progress??created.job_progress_before??0,iteration:resumeJob?resumeJob.sessions.length+1:(created.job_iteration||1),createdAt:resumeJob?.first?.job_created_at||resumeJob?.first?.created_at||created.job_created_at||created.created_at||created.clock_in_at,resumeOf:resumeJob?.latestCompleted?.id||resumeJob?.latest?.id||created.job_resume_of_session_id||''});
    await flushWorkActivityState71();await renderMts();
  };

  const baseOpenMtsClockOut71=openMtsClockOut;
  openMtsClockOut=function(id){
    let row=state.mtsSessions.find(x=>String(x.id)===String(id));if(row&&!workActivityJobId70(row)){row=repairActiveWorkActivityJob71(row);flushWorkActivityState71().catch(()=>{});}
    return baseOpenMtsClockOut71(id);
  };

  const baseCompleteMtsSession71=completeMtsSession;
  completeMtsSession=async function(){
    if(!STANDALONE_MODE)return baseCompleteMtsSession71();
    const id=$('mtsClockOutId')?.value||'',row=state.mtsSessions.find(x=>String(x.id)===String(id));if(!row){toast('The active work session could not be found. Refresh Work Activity Hub and try again.');return;}
    const raw=String($('mtsCompletion')?.value??'').trim();if(raw===''){toast('Enter the progress reached for this Job ID before clocking out.');$('mtsCompletion')?.focus();return;}
    const previous=Math.max(0,Math.min(100,Number(row.job_progress_before??row.job_progress_total??0)||0));let progress;try{progress=normalizeWorkActivityProgress70(previous,Number(raw));}catch(err){toast(err.message||String(err));$('mtsCompletion')?.focus();return;}
    const repaired=workActivityJobId70(row)?row:repairActiveWorkActivityJob71(row),jobId=workActivityJobId70(repaired)||uniqueWorkActivityJobId70(),btn=$('mtsConfirmClockOut');btn.disabled=true;btn.textContent='Capturing location…';
    try{
      const loc=await captureLocation(),out=new Date().toISOString(),onTime=$('mtsOnTime').value==='true',comments=$('mtsDelayComments').value.trim(),store=localMtsStore(),idx=store.sessions.findIndex(x=>String(x.id)===String(id));if(idx<0)throw new Error('Work session not found in the saved Work Activity record.');
      btn.textContent='Saving work…';ensureLocalMtsContext(row.employee_id,row.employee_name,row.department,row.project_code,row.work_date);const current=store.sessions[idx];let updated={...current,job_id:jobId,job_iteration:Math.max(1,Number(current.job_iteration||row.job_iteration||1)),job_progress_before:previous,job_progress_total:progress.total,session_progress_delta:progress.delta,job_progress_input:progress.entered,job_progress_input_mode:progress.mode,job_status:progress.total>=100?'completed':'pending',job_completed_at:progress.total>=100?out:'',job_updated_at:out,clock_out_at:out,duration_hours:mtsDurationHours(current.clock_in_at,out),completion_percent:progress.total,on_time:onTime,delay_comments:comments,clock_out_location:loc.label||`${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}`,clock_out_lat:loc.lat??null,clock_out_lng:loc.lng??null,clock_out_accuracy_m:loc.accuracy_m??null,clock_out_captured_at:loc.captured_at||out,status:'completed',locked:true,updated_at:out};
      try{const draftId=`MTS-DRAFT-${updated.id}`;if(updated.duration_hours>0&&updated.duration_hours<=24){const existing=engine.state.timeEntries.some(x=>String(x.entryId)===String(draftId));if(!existing){const draft=engine.addTimeEntry({companyId:updated.companyId||currentCompanyId(),entryId:draftId,date:updated.work_date,projectCode:updated.project_code,hours:updated.duration_hours,activity:updated.activity_description,status:'Draft',employeeId:updated.employee_id,aiSuggestedProject:updated.project_code,employeeDecision:'Accepted'});updated.recovery_entry_id=draft.entryId;}else updated.recovery_entry_id=draftId;updated.recovery_bridge_status='draft_created';}else updated.recovery_bridge_status='bridge_review';}catch(err){updated.recovery_bridge_status=`bridge_review: ${err.message}`;}
      store.sessions[idx]=updated;saveLocalMtsStore(store);state.mtsSessions=store.sessions;syncLocalMtsSource(updated.work_date);persistLocalLiveState();await flushWorkActivityState71();
      $('mtsClockOutDialog').close();populateMonths();populateMtsMasters();window.dispatchEvent(new CustomEvent('assurance-regent-workday-event',{detail:{type:'clock_out',at:out,user:controlUser()}}));
      if(progress.total>=100)toast(`${jobId} reached 100% and is complete. Earlier work-session records remain unchanged.`);else toast(`${jobId} clocked out successfully and remains pending at ${num(progress.total,0)}%. This session contributed ${num(progress.delta,0)}%.`);
      await renderMts();refreshCurrent();await refreshControlCenter();
    }catch(err){reportClientIncident('work-activity-clockout',err?.message||String(err),{session_id:id,job_id:jobId},'HIGH');toast(err?.message||'Could not clock out.');}
    finally{btn.disabled=false;btn.textContent='Clock Out & create draft evidence';}
  };
  /* Assurance Regent v6.3.71 — reliable Job ID clock-out END */
