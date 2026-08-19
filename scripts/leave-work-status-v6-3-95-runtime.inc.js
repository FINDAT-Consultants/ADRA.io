  /* Assurance Regent v6.3.95 — leave submit reset + dedicated Work Status START */
  const LEAVE_WORK_STATUS_SCHEMA95='6.3.95';
  const WORK_STATUS_VIEW95='work-status';

  Object.assign(meta,{
    leave:['People operations','Leave','Submit leave requests, review approvals and manage leave policy without mixing work-location updates into the page.'],
    [WORK_STATUS_VIEW95]:['Work availability','Work Status','Tell the organization where you are working from. Your submitted status updates the live workforce dashboard automatically.']
  });

  function ensureSelectPlaceholder95(select,text){
    if(!select)return;
    if(![...select.options].some(o=>o.value===''))select.insertAdjacentHTML('afterbegin',`<option value="">${esc(text)}</option>`);
  }

  function resetLeaveRequestForm95(){
    const form=$('leaveRequestForm');if(!form)return;
    form.reset();
    const canManage=Boolean(controlPermissions()?.canManageLeave),employee=$('leaveEmployeeInput'),type=$('leaveTypeInput');
    if(canManage){ensureSelectPlaceholder95(employee,'Select employee');employee.value='';}
    ensureSelectPlaceholder95(type,'Select leave type');type.value='';
    if($('leaveStartInput'))$('leaveStartInput').value='';
    if($('leaveEndInput'))$('leaveEndInput').value='';
    if($('leaveDaysInput'))$('leaveDaysInput').value='';
    if($('leaveReasonInput'))$('leaveReasonInput').value='';
    if($('leaveMedicalInput'))$('leaveMedicalInput').value='';
    if($('leaveMultipleBirthInput'))$('leaveMultipleBirthInput').checked=false;
    if($('leaveMultipleBirthWrap'))$('leaveMultipleBirthWrap').hidden=true;
  }

  submitLeaveRequest=async function(e){
    e?.preventDefault?.();
    const form=e?.currentTarget||$('leaveRequestForm'),submit=form?.querySelector('button[type="submit"]'),original=submit?.textContent||'Submit leave request';
    const u=controlUser()||{},canManage=Boolean(controlPermissions()?.canManageLeave),employeeId=canManage?String($('leaveEmployeeInput')?.value||''):(leaveActorEmployee()?.employeeId||u.id||''),type=String($('leaveTypeInput')?.value||''),start=String($('leaveStartInput')?.value||''),end=String($('leaveEndInput')?.value||''),days=Number($('leaveDaysInput')?.value||leaveBusinessDays(start,end)||0);
    if(!employeeId)return toast('Select the employee requesting leave.');
    if(!type)return toast('Select a leave type.');
    if(!start||!end)return toast('Enter both the leave start and end dates.');
    if(end<start)return toast('Leave end date cannot be before the start date.');
    if(!Number.isFinite(days)||days<=0)return toast('Enter a valid number of requested leave days.');
    try{
      if(submit){submit.disabled=true;submit.textContent='Submitting…';}
      await supabaseRpc('assurance_regent_browser_leave_apply',{p_token:browserSessionToken,p_employee_id:employeeId,p_leave_type:type,p_start_date:start,p_end_date:end,p_requested_days:days,p_reason:String($('leaveReasonInput')?.value||'').trim(),p_medical_certificate_name:String($('leaveMedicalInput')?.value||'').trim(),p_multiple_birth:Boolean($('leaveMultipleBirthInput')?.checked)});
      state.leaveLoadedAt=0;await loadLeaveData(true);await renderLeave();renderDashboardLeave();resetLeaveRequestForm95();
      if(state.view==='automation'&&typeof renderAutomationCentre94==='function')renderAutomationCentre94();
      toast('Leave request submitted. The form is ready for a new request.');
    }catch(err){toast(err?.message||String(err));}
    finally{if(submit){submit.disabled=false;submit.textContent=original;}}
  };

  function workStatusAllowed95(){
    const u=controlUser();if(!u)return false;const p=controlPermissions()||{},allowed=new Set(p.allowedViews||[]);return allowed.has('*')||allowed.has('leave')||allowed.has(WORK_STATUS_VIEW95);
  }

  function ensureWorkStatusView95(){
    meta[WORK_STATUS_VIEW95]=['Work availability','Work Status','Tell the organization where you are working from. Your submitted status updates the live workforce dashboard automatically.'];
    const leaveNav=document.querySelector('.nav-item[data-view="leave"]');let nav=document.querySelector(`.nav-item[data-view="${WORK_STATUS_VIEW95}"]`);
    if(leaveNav)leaveNav.innerHTML='<span>☘</span> Leave';
    if(!nav&&leaveNav){nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.dataset.view=WORK_STATUS_VIEW95;nav.innerHTML='<span>⌖</span> Work Status';leaveNav.insertAdjacentElement('afterend',nav);}
    let view=$(`view-${WORK_STATUS_VIEW95}`);if(!view){view=document.createElement('div');view.className='view';view.id=`view-${WORK_STATUS_VIEW95}`;const leaveView=$('view-leave');if(leaveView)leaveView.insertAdjacentElement('afterend',view);else document.querySelector('.content')?.appendChild(view);}
    if(view&&!view.querySelector('[data-work-status-hero95]'))view.insertAdjacentHTML('afterbegin','<section class="work-status-hero95 panel" data-work-status-hero95><div><span class="section-kicker">Live work location</span><h2>Where are you working from?</h2><p>Submit your current work status once. Assurance Regent updates the dashboard and workforce availability directory automatically.</p></div><div class="work-status-current95" id="workStatusCurrent95"><small>Current status</small><b>Not recorded</b><span>Submit a status below.</span></div></section>');
    const form=$('workStatusForm'),panel=form?.closest('section.panel');if(view&&panel&&panel.parentElement!==view){panel.classList.add('work-status-panel95');view.appendChild(panel);}
    const dashboardButton=$('dashWorkStatusPeople')?.closest('.leave-dashboard-grid')?.querySelector('[data-go="leave"]');if(dashboardButton){dashboardButton.dataset.go=WORK_STATUS_VIEW95;dashboardButton.textContent='Update status';}
    if(nav)nav.hidden=!workStatusAllowed95();
    return view;
  }

  function workStatusVisibleRows95(canManage,self){
    const rows=newestFirst(state.workStatuses||[],['updated_at','created_at','until_date']);if(canManage){const ids=managedEmployeeIdSet(controlUser()||{});return rows.filter(r=>rowEmployeeMatch(r,ids));}
    const selfIds=new Set([self?.employeeId,self?.name,self?.email,controlUser()?.id,controlUser()?.name,controlUser()?.email].filter(Boolean).map(v=>String(v).trim().toLowerCase()));return rows.filter(r=>rowEmployeeMatch(r,selfIds));
  }

  function resetWorkStatusForm95(){
    const form=$('workStatusForm');if(!form)return;const canManage=canManageEmployeeStatus(),employee=$('workStatusEmployeeInput'),status=$('workStatusInput');
    form.reset();if(canManage){ensureSelectPlaceholder95(employee,'Select employee');employee.value='';}
    ensureSelectPlaceholder95(status,'Select work status');status.value='';if($('workStatusUntilInput'))$('workStatusUntilInput').value='';if($('workStatusNoteInput'))$('workStatusNoteInput').value='';
  }

  async function renderWorkStatusView95(reset=false){
    ensureWorkStatusView95();await loadLeaveData();const u=controlUser()||{},canManage=canManageEmployeeStatus(),employees=managedEmployeesForUser(u),self=leaveActorEmployee();const employee=$('workStatusEmployeeInput'),wrap=$('workStatusEmployeeWrap');
    if(wrap)wrap.hidden=!canManage;
    if(employee){const current=employee.value,rows=canManage?employees:[self].filter(Boolean);employee.innerHTML=(canManage?'<option value="">Select employee</option>':'')+rows.map(x=>`<option value="${esc(x.employeeId)}">${esc(x.name)} · ${esc(x.employeeId)}</option>`).join('')||`<option value="${esc(u.id||'')}">${esc(u.name||u.id||'Current user')}</option>`;if(current&&[...employee.options].some(o=>o.value===current))employee.value=current;else if(!canManage&&self?.employeeId)employee.value=self.employeeId;}
    const status=$('workStatusInput');ensureSelectPlaceholder95(status,'Select work status');if(reset&&status)status.value='';
    const visible=workStatusVisibleRows95(canManage,self),directory=$('workStatusDirectory');if(directory)directory.innerHTML=visible.length?visible.map(x=>`<article class="leave-status-card"><div><b>${esc(x.employee_name||x.employee_id)}</b><small>${esc(x.note||x.employee_id)}${x.until_date?` · until ${esc(String(x.until_date).slice(0,10))}`:''}</small></div>${workStatusChip(x.status)}</article>`).join(''):'<div class="people-list-empty">No work-location status has been recorded in your current scope.</div>';
    const selfId=self?.employeeId||u.id||'',current=(state.workStatuses||[]).find(x=>String(x.employee_id||x.employeeId||'').toLowerCase()===String(selfId).toLowerCase()),summary=$('workStatusCurrent95');if(summary)summary.innerHTML=current?`<small>Current status</small><b>${esc(WORK_STATUS_LABELS[String(current.status||'').toUpperCase()]||current.status||'Recorded')}</b><span>${esc(current.note||'Live workforce dashboard is up to date.')}${current.until_date?` · until ${esc(String(current.until_date).slice(0,10))}`:''}</span>`:'<small>Current status</small><b>Not recorded</b><span>Submit a status below.</span>';
  }

  submitWorkStatus=async function(e){
    e?.preventDefault?.();const form=e?.currentTarget||$('workStatusForm'),submit=form?.querySelector('button[type="submit"]'),original=submit?.textContent||'Update work status',u=controlUser()||{},canManage=canManageEmployeeStatus(),employeeId=canManage?String($('workStatusEmployeeInput')?.value||''):(leaveActorEmployee()?.employeeId||u.id||''),status=String($('workStatusInput')?.value||'');
    if(!employeeId)return toast('Select the employee whose work status is being updated.');if(!status)return toast('Select a work status.');
    try{if(submit){submit.disabled=true;submit.textContent='Updating…';}await supabaseRpc('assurance_regent_browser_work_status_set',{p_token:browserSessionToken,p_employee_id:employeeId,p_status:status,p_note:String($('workStatusNoteInput')?.value||'').trim(),p_until_date:$('workStatusUntilInput')?.value||null});state.leaveLoadedAt=0;await loadLeaveData(true);renderDashboardLeave();await renderWorkStatusView95(true);resetWorkStatusForm95();toast('Work status updated. The dashboard now reflects the latest location/status.');}
    catch(err){toast(err?.message||String(err));}finally{if(submit){submit.disabled=false;submit.textContent=original;}}
  };

  const applyAccessControlBase95=applyAccessControl;
  applyAccessControl=function(){const result=applyAccessControlBase95();ensureWorkStatusView95();const nav=document.querySelector(`.nav-item[data-view="${WORK_STATUS_VIEW95}"]`);if(nav)nav.hidden=!workStatusAllowed95();const group=nav?.closest('.nav-group');if(group&&workStatusAllowed95())group.hidden=false;return result;};

  const refreshCurrentBase95=refreshCurrent;
  refreshCurrent=function(){const result=refreshCurrentBase95();if(state.view===WORK_STATUS_VIEW95)renderWorkStatusView95().catch(err=>toast(err?.message||String(err)));return result;};

  const automationViewAllowedBase95=automationViewAllowed94;
  automationViewAllowed94=function(view){if(view===WORK_STATUS_VIEW95)return workStatusAllowed95();return automationViewAllowedBase95(view);};
  const automationFeatureGroupsBase95=automationFeatureGroups94;
  automationFeatureGroups94=function(){return automationFeatureGroupsBase95().map(group=>{if(group.title!=='People & company')return group;const items=[];for(const item of group.items){if(item[0]==='leave'){items.push(['leave','Leave','Leave applications, approvals and policy']);items.push([WORK_STATUS_VIEW95,'Work Status','Office, home, field and travel location updates']);}else items.push(item);}return {...group,items};});};

  window.addEventListener('assurance-regent-session-ready',()=>{ensureWorkStatusView95();resetLeaveRequestForm95();if(state.view===WORK_STATUS_VIEW95)renderWorkStatusView95().catch(()=>{});});
  ensureWorkStatusView95();
  /* Assurance Regent v6.3.95 — leave submit reset + dedicated Work Status END */