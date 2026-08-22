  /* Assurance Regent v6.3.118 — onboarding completion transfer START */
  const ONBOARDING_COMPLETION_TRANSFER_SCHEMA118='6.3.118';
  const ONBOARDING_COMPLETION_EVENT118='assurance-regent-onboarding-completed';
  function onboardingActiveRows118(){return newestFirst(engine.state.onboarding,['updatedAt','createdAt','hireDate']).filter(o=>String(o?.status||'').trim().toLowerCase()!=='complete');}
  function onboardingEmployeeFor118(row={}){const employeeId=String(row.employeeId||'').trim(),companyId=String(row.companyId||currentCompanyId?.()||'').trim();return (engine.state.employees||[]).find(e=>String(e.employeeId||'').trim()===employeeId&&(!companyId||String(e.companyId||'').trim()===companyId))||null;}
  function onboardingCandidateFor118(row={}){const id=String(row.candidateId||'').trim();return id?(engine.state.candidates||[]).find(c=>String(c.id||'')===id)||null:null;}
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
    $('onboardingWizard').innerHTML=`<div class="onboarding-wizard-head"><div><span class="section-kicker">Onboarding a new employee</span><h2>${esc(row.name)}</h2></div>${directoryStatusChip(row.status)}</div><div class="onboarding-steps">${steps.map((x,i)=>`<span class="${i+1===step?'active':i+1<step?'done':''}"><b>${i+1===5?'Finish':`Part ${i+1}`}</b><i></i></span>`).join('')}</div><div class="onboarding-profile-layout"><aside class="onboarding-profile-card">${candidateIdentity(row,'lg')}<strong>${esc(row.jobTitle||'Job title not set')}</strong><small>${esc(row.employeeId||'Employee ID pending')}</small></aside><div class="onboarding-step-card">${content}</div></div><div class="onboarding-actions"><button class="btn ghost" type="button" data-onboarding-nav="-1" ${step<=1?'disabled':''}>Back</button><button class="btn primary" type="button" data-onboarding-nav="1">${step>=5?'Complete onboarding':'Next'}</button></div>`;
  };
  const moveOnboardingBefore118=moveOnboarding;
  moveOnboarding=async function(direction){
    const row=engine.state.onboarding.find(o=>o.id===state.onboardingSelected);if(!row)return;
    const step=Math.max(1,Math.min(5,Number(row.step||1))),completing=Number(direction)>0&&step>=5&&String(row.status||'').trim().toLowerCase()!=='complete';
    if(!completing)return moveOnboardingBefore118(direction);
    const next={...row,step:5,status:'Complete',checklist:{...(row.checklist||{}),step5:true}};
    try{
      const saved=await saveOnboardingRecord(next);
      if(STANDALONE_MODE&&typeof flushStandaloneSave==='function')await flushStandaloneSave();
      state.onboardingSelected='';
      await reloadLiveState();
      const employee=onboardingEmployeeFor118(next),candidate=onboardingCandidateFor118(next),candidateHired=!candidate||String(candidate.status||'').trim().toLowerCase()==='hired';
      renderOnboarding();renderEmployees();renderCompany();
      window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETION_EVENT118,{detail:{schema:ONBOARDING_COMPLETION_TRANSFER_SCHEMA118,onboardingId:next.id||'',candidateId:next.candidateId||'',employeeId:next.employeeId||'',employeeCreated:Boolean(employee),candidateHired,removedFromActiveQueue:true,persistedBeforeReload:true}}));
      if(employee&&candidateHired)toast(`Onboarding completed. ${next.name||next.employeeId||'The candidate'} has moved to Employees.`);else toast('Onboarding completed, but the employee transfer requires attention. Refresh Employees and review the record.');
      return saved;
    }catch(err){toast(err.message);}
  };
  window.AssuranceRegentOnboardingCompletionTransfer={schema:ONBOARDING_COMPLETION_TRANSFER_SCHEMA118,activeQueueOnly:true,completedRecordsRetainedForAudit:true,employeeTransfer:true,candidateMarkedHired:true,persistedBeforeReload:true,event:ONBOARDING_COMPLETION_EVENT118};
  /* Assurance Regent v6.3.118 — onboarding completion transfer END */
