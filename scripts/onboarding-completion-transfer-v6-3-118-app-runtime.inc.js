  /* Assurance Regent v6.3.118 — onboarding completion transfer START */
  const ONBOARDING_COMPLETION_TRANSFER_SCHEMA118='6.3.118-hard';
  const ONBOARDING_COMPLETION_EVENT118='assurance-regent-onboarding-completed';
  let onboardingCompletionBusy118=false;
  function onboardingActiveRows118(){return newestFirst(engine.state.onboarding,['updatedAt','createdAt','hireDate']).filter(o=>String(o?.status||'').trim().toLowerCase()!=='complete');}
  function onboardingEmployeeFor118(row={}){const employeeId=String(row.employeeId||'').trim(),companyId=String(row.companyId||currentCompanyId?.()||'').trim();return (engine.state.employees||[]).find(e=>String(e.employeeId||'').trim()===employeeId&&(!companyId||String(e.companyId||'').trim()===companyId))||null;}
  function onboardingCandidateFor118(row={}){const id=String(row.candidateId||'').trim();return id?(engine.state.candidates||[]).find(c=>String(c.id||'')===id)||null:null;}
  function onboardingPersisted118(row={}){const active=(engine.state.onboarding||[]).find(o=>String(o.id||'')===String(row.id||'')),employee=onboardingEmployeeFor118(row),candidate=onboardingCandidateFor118(row),candidateHired=!candidate||String(candidate.status||'').trim().toLowerCase()==='hired',removedFromActiveQueue=!active,legacyComplete=Boolean(active)&&String(active.status||'').trim().toLowerCase()==='complete';return {active,employee,candidate,candidateHired,removedFromActiveQueue,legacyComplete,ok:Boolean(employee)&&candidateHired&&(removedFromActiveQueue||legacyComplete)};}
  function reconcileOnboardingCompletion118(row={}){
    const companyId=String(row.companyId||currentCompanyId?.()||'').trim();
    const current=(engine.state.onboarding||[]).find(o=>String(o.id||'')===String(row.id||''));
    const completed={...(current||row),...row,companyId,step:5,status:'Complete',checklist:{...((current||row).checklist||{}),...(row.checklist||{}),step5:true}};
    const saved=engine.upsertOnboarding(completed);
    if(saved.candidateId){const candidate=(engine.state.candidates||[]).find(c=>String(c.id||'')===String(saved.candidateId||''));if(candidate&&String(candidate.status||'').trim().toLowerCase()!=='hired')engine.upsertCandidate({...candidate,status:'Hired'});}
    if(saved.employeeId)engine.upsertEmployee({companyId:saved.companyId||companyId,employeeId:saved.employeeId,name:saved.name,position:saved.jobTitle,department:saved.department,location:saved.location,employmentType:saved.employmentType,employmentStatus:'Active',profilePhoto:saved.profilePhoto,startDate:saved.hireDate,active:'Yes',hoursPerDay:8});
    persistLocalLiveState();
    return saved;
  }
  async function flushStandaloneSaveFully118(){
    if(!STANDALONE_MODE||!browserSessionToken||typeof flushStandaloneSave!=='function')return true;
    for(let attempt=0;attempt<10;attempt+=1){
      if(standaloneSaveTimer){clearTimeout(standaloneSaveTimer);standaloneSaveTimer=null;}
      if(standaloneSaveInFlight){await standaloneSaveQueue;continue;}
      if(standaloneSavePending){await flushStandaloneSave();continue;}
      return true;
    }
    if(standaloneSaveInFlight)await standaloneSaveQueue;
    if(standaloneSavePending){if(standaloneSaveTimer){clearTimeout(standaloneSaveTimer);standaloneSaveTimer=null;}await flushStandaloneSave();if(standaloneSaveInFlight)await standaloneSaveQueue;}
    if(standaloneSavePending||standaloneSaveInFlight)throw new Error('Onboarding completion could not finish its Supabase save queue.');
    return true;
  }
  async function authoritativeOnboardingReadback118(){
    if(STANDALONE_MODE&&browserSessionToken&&typeof loadStandaloneState==='function'){await loadStandaloneState();if(typeof loadLiveState==='function')await loadLiveState();}
  }
  async function persistAndVerifyOnboardingCompletion118(row={}){
    let saved=await saveOnboardingRecord({...row,step:5,status:'Complete',checklist:{...(row.checklist||{}),step5:true}});
    saved=reconcileOnboardingCompletion118({...row,...saved,step:5,status:'Complete'});
    await flushStandaloneSaveFully118();
    await authoritativeOnboardingReadback118();
    let check=onboardingPersisted118(saved);
    if(!check.ok){
      saved=reconcileOnboardingCompletion118({...row,...saved,step:5,status:'Complete'});
      await flushStandaloneSaveFully118();
      await authoritativeOnboardingReadback118();
      check=onboardingPersisted118(saved);
    }
    if(!check.ok)throw new Error('Onboarding completion was not confirmed in Supabase. No silent transfer was allowed.');
    return {...check,saved};
  }
  const renderOnboardingBefore118=renderOnboarding;
  renderOnboarding=function(){
    if(!$('onboardingQueue'))return renderOnboardingBefore118();
    const accepted=engine.state.candidates.filter(c=>c.stage==='Offer Accepted'&&String(c.status||'Active').toLowerCase()!=='hired');
    $('onboardingCandidateSelect').innerHTML=accepted.length?'<option value="">Select candidate</option>'+accepted.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(vacancyForCandidate(c)?.title||c.jobTitle||'Offer accepted')}</option>`).join(''):'<option value="">No offer-accepted candidates</option>';
    const rows=onboardingActiveRows118();$('onboardingCount').textContent=rows.length;
    if(!rows.some(o=>o.id===state.onboardingSelected))state.onboardingSelected=rows[0]?.id||'';
    $('onboardingQueue').innerHTML=rows.length?rows.map(o=>`<button type="button" class="onboarding-queue-item ${o.id===state.onboardingSelected?'active':''}" data-onboarding-id="${esc(o.id)}">${candidateIdentity(o,'xs')}<span><b>${esc(o.status)}</b><small>Step ${o.step} of 5</small></span></button>`).join(''):'<div class="people-list-empty"><b>No active onboarding records.</b><span>Completed hires are available in Employees.</span></div>';
    const row=rows.find(o=>o.id===state.onboardingSelected);if(!row){$('onboardingWizard').innerHTML='<div class="onboarding-empty"><span>✓</span><b>No active onboarding record selected</b><p>Completed candidates leave this queue automatically and are available in Employees.</p></div>';return;}
    const steps=['Profile','Documents','Payroll','Work setup','Finish'],step=Math.max(1,Math.min(5,Number(row.step||1))),content=onboardingStepContent(row,step);
    $('onboardingWizard').innerHTML=`<div class="onboarding-wizard-head"><div><span class="section-kicker">Onboarding a new employee</span><h2>${esc(row.name)}</h2></div>${directoryStatusChip(row.status)}</div><div class="onboarding-steps">${steps.map((x,i)=>`<span class="${i+1===step?'active':i+1<step?'done':''}"><b>${i+1===5?'Finish':`Part ${i+1}`}</b><i></i></span>`).join('')}</div><div class="onboarding-profile-layout"><aside class="onboarding-profile-card">${candidateIdentity(row,'lg')}<strong>${esc(row.jobTitle||'Job title not set')}</strong><small>${esc(row.employeeId||'Employee ID pending')}</small></aside><div class="onboarding-step-card">${content}</div></div><div class="onboarding-actions"><button class="btn ghost" type="button" data-onboarding-nav="-1" ${step<=1||onboardingCompletionBusy118?'disabled':''}>Back</button><button class="btn primary" type="button" data-onboarding-nav="1" ${onboardingCompletionBusy118?'disabled aria-busy="true"':''}>${onboardingCompletionBusy118&&step>=5?'Completing…':step>=5?'Complete onboarding':'Next'}</button></div>`;
  };
  const moveOnboardingBefore118=moveOnboarding;
  moveOnboarding=async function(direction){
    const row=engine.state.onboarding.find(o=>o.id===state.onboardingSelected);if(!row)return;
    const step=Math.max(1,Math.min(5,Number(row.step||1))),completing=Number(direction)>0&&step>=5&&String(row.status||'').trim().toLowerCase()!=='complete';
    if(!completing)return moveOnboardingBefore118(direction);
    if(onboardingCompletionBusy118)return;
    onboardingCompletionBusy118=true;renderOnboarding();
    const next={...row,step:5,status:'Complete',checklist:{...(row.checklist||{}),step5:true}};
    try{
      const result=await persistAndVerifyOnboardingCompletion118(next);
      state.onboardingSelected='';state.employeeDirectoryFilter='';state.employeeDirectorySearch=String(next.employeeId||next.name||'').trim();
      renderOnboarding();renderEmployees();renderCompany();
      const employeesOpened=typeof switchView==='function'?switchView('employees'):false;
      if(!employeesOpened){const nav=document.querySelector('[data-view="employees"], [data-nav-view="employees"], a[href="#employees"]');nav?.click?.();}
      window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETION_EVENT118,{detail:{schema:ONBOARDING_COMPLETION_TRANSFER_SCHEMA118,onboardingId:next.id||'',candidateId:next.candidateId||'',employeeId:next.employeeId||'',employeeCreated:Boolean(result.employee),candidateHired:result.candidateHired,removedFromActiveQueue:result.removedFromActiveQueue||result.legacyComplete,persistedBeforeReload:true,authoritativeReadback:true,retriedUntilConfirmed:true,navigatedToEmployees:Boolean(employeesOpened)}}));
      toast(`Onboarding completed. ${next.name||next.employeeId||'The candidate'} is now an active employee.`);
      return result.saved;
    }catch(err){console.error('Hard onboarding completion failed',err);if(typeof reportClientIncident==='function')reportClientIncident('onboarding-completion',err?.message||String(err),{onboardingId:next.id||'',candidateId:next.candidateId||'',employeeId:next.employeeId||'',schema:ONBOARDING_COMPLETION_TRANSFER_SCHEMA118},'HIGH');toast(err?.message||'Onboarding completion failed.');throw err;}
    finally{onboardingCompletionBusy118=false;if(document.getElementById('onboardingWizard'))renderOnboarding();}
  };
  function installOnboardingCompletionCapture118(){
    if(window.__assuranceOnboardingCompletionCapture118)return;window.__assuranceOnboardingCompletionCapture118=true;
    document.addEventListener('click',function(event){const target=event.target instanceof Element?event.target.closest('[data-onboarding-nav]'):null,wizard=document.getElementById('onboardingWizard');if(!target||!wizard||!wizard.contains(target))return;event.preventDefault();event.stopImmediatePropagation();if(target.disabled||target.getAttribute('aria-busy')==='true')return;void moveOnboarding(Number(target.dataset.onboardingNav)).catch(()=>{});},true);
  }
  installOnboardingCompletionCapture118();
  window.AssuranceRegentOnboardingCompletionTransfer={schema:ONBOARDING_COMPLETION_TRANSFER_SCHEMA118,activeQueueOnly:true,completedRecordsRetainedForAudit:true,employeeTransfer:true,candidateMarkedHired:true,persistedBeforeReload:true,autoOpenEmployees:true,capturePhaseOverride:true,drainSaveQueue:true,authoritativeReadback:true,retryUntilConfirmed:true,successRequiresEmployeeAndHiredCandidate:true,successAcceptsArchivedRemoval:true,event:ONBOARDING_COMPLETION_EVENT118};
  /* Assurance Regent v6.3.118 — onboarding completion transfer END */
