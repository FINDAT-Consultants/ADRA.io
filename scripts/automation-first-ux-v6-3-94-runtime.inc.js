  /* Assurance Regent v6.3.94 — automation-first role work centre START */
  const AUTOMATION_FIRST_UX_SCHEMA94='6.3.94';
  const AUTOMATION_REFRESH_MS94=60000;
  let automationLastSync94=0,automationRefreshBusy94=false;

  Object.assign(meta,{
    dashboard:['Work overview','Dashboard','Your live work queue, people signals and recovery position in one place.'],
    work:['Automated work evidence','Work Activity Hub','Clock in once; clock-out captures elapsed work and feeds linked recovery evidence automatically.'],
    time:['Approval workflow','Recovery Time Entry','System-generated recovery evidence moves through human approval without duplicate timesheet capture.'],
    payroll:['Recovery cost foundation','Payroll','Authorized payroll inputs feed recovery costing automatically when no approved imported rate exists.'],
    calendar:['Automated capacity','Calendar','Work schedules and captured activity feed capacity and reconciliation controls.'],
    monthly:['Automated recovery calculation','Monthly Engine','Recalculates from approved operational data, payroll, budgets and active controls.'],
    checks:['Management by exception','Checks','Focus on real reconciliation and configuration issues that require intervention.'],
    exceptions:['Management by exception','Recovery Exceptions','Shows only blocked, partial or at-risk recovery items that need action.'],
    assurance:['Automated recovery assurance','Recovery Assurance','Live Recovery Passports are built from approved evidence, active budgets and donor controls.'],
    voucher:['Automated cost recovery','Recovery Voucher','Calculates allowable recovery from approved work, rates, budgets and donor rules.'],
    audit:['Traceable assurance','Audit Centre','Control results and evidence remain traceable while routine calculations are automated.']
  });

  function automationViewAllowed94(view){
    if(view==='budget-import')return typeof budgetImportClientEligible85==='function'&&budgetImportClientEligible85();
    const nav=document.querySelector(`.nav-item[data-view="${view}"]`);
    if(nav&&nav.hidden)return false;
    try{if(typeof agentCanOpenView==='function')return Boolean(agentCanOpenView(view));}catch{}
    return Boolean(nav||$(`view-${view}`));
  }
  function automationOpen94(target,panel=''){
    if(panel){openControlPanel(panel);return true;}
    if(target==='budget-import'&&typeof openBudgetImportView85==='function'){openBudgetImportView85();return true;}
    return switchView(target);
  }
  function automationRequestTarget94(type=''){
    const t=String(type||'').toLowerCase();
    if(t==='payroll')return ['payroll','Open payroll'];
    if(t==='recovery time')return ['time','Review evidence'];
    if(t==='active work')return ['work','Open work'];
    if(t.includes('leave')||t.includes('maternity')||t.includes('paternity')||t.includes('sick')||t.includes('compassionate'))return ['leave','Review leave'];
    return ['dashboard','Open'];
  }

  function automationTasks94(){
    const tasks=[];
    for(const row of dashboardRequestRows()){
      const [target,label]=automationRequestTarget94(row.type);tasks.push({kind:'OPERATIONS',title:`${row.type}: ${row.person?.name||row.name||'Needs attention'}`,detail:[row.period,row.note].filter(Boolean).join(' · '),target,label,date:row.date||''});
    }
    try{
      const b=budgetImportBundle85||{},rows=Array.isArray(b.batches)?b.batches:[],uid=String(controlUser()?.id||'');
      for(const row of rows){
        if(b.canFinanceReview&&row.status==='PENDING_FINANCE_REVIEW'&&String(row.uploaded_by)!==uid)tasks.push({kind:'FINANCE',title:'Budget batch needs Finance review',detail:`${row.version_label||`Version ${row.version_no}`} · ${row.file_name||'Excel budget'}`,target:'budget-import',label:'Review budget',date:row.uploaded_at||''});
        if(b.canCountryApprove&&row.status==='PENDING_COUNTRY_DIRECTOR'&&String(row.uploaded_by)!==uid&&String(row.finance_reviewed_by||'')!==uid)tasks.push({kind:'APPROVAL',title:'Budget batch needs final approval',detail:`${row.version_label||`Version ${row.version_no}`} · Finance review completed`,target:'budget-import',label:'Approve budget',date:row.finance_reviewed_at||row.uploaded_at||''});
      }
    }catch{}
    try{for(const row of recoveryExceptionRows())tasks.push({kind:'RECOVERY',title:`Recovery action: ${row.employee||row.employeeId||'Employee'} · ${row.projectCode||'Project'}`,detail:`${row.finalStatus||row.recoveryMode||'Review'}${Number(row.amountAtRisk||0)>0?` · ${money(row.amountAtRisk)} at risk`:''}`,target:'exceptions',label:'Open exception',date:row.reportingMonth||state.month});}catch{}
    try{if(recruitmentHrAllowed())for(const n of (recruitmentBundle().notifications||[]).filter(x=>String(x.status||'NEW').toUpperCase()!=='READ'))tasks.push({kind:'HR',title:n.title||'Recruitment application needs review',detail:n.detail||'Open Recruiting to review the applicant.',target:'recruiting',label:'Open recruiting',date:n.created_at||''});}catch{}
    try{if(controlPermissions()?.canReview)for(const d of (state.control?.documents||[]).filter(x=>String(x.status||'').toUpperCase()==='PENDING_REVIEW'))tasks.push({kind:'DOCUMENT',title:`Document review: ${d.name||'Document'}`,detail:[d.source,d.employeeName,d.projectCode].filter(Boolean).join(' · '),panel:'documents',label:'Review document',date:d.uploadedAt||''});}catch{}
    try{if(systemHealthAllowed()&&Number(state.systemHealth?.staleTasks||0)>0)tasks.push({kind:'SYSTEM',title:`${state.systemHealth.staleTasks} stale background task(s)`,detail:'Jivan safe-recovery can repair these automatically.',target:'health',label:'Open System Health',date:state.systemHealth?.generatedAt||''});}catch{}
    return newestFirst(tasks,['date']);
  }

  function automationFeatureGroups94(){return [
    {title:'People & company',items:[['company','Company','Directory, structure and organization records'],['employees','Employees','Employee master and identity'],['recruiting','Recruiting','Vacancies, applicants and interviews'],['onboarding','Onboarding','Accepted candidate to employee transition'],['leave','Leave & Work Status','Leave, availability and work location']]},
    {title:'Work & delivery',items:[['work','Work Activity Hub','Live work capture and evidence'],['time','Recovery Time Entry','Approval of recovery evidence'],['projects','Projects','Project, donor and eligibility master'],['calendar','Calendar','Capacity and working-day controls']]},
    {title:'Finance & recovery',items:[['payroll','Payroll','Authorized employment cost'],['budget-import','Budget & Donor Import','Bulk budgets, rates and donor rules'],['monthly','Monthly Engine','Automated monthly recovery calculations'],['voucher','Recovery Voucher','Allowable cost calculation'],['exceptions','Recovery Exceptions','Only items needing management action'],['assurance','Recovery Assurance','Recovery Passports and accounting handoff'],['checks','Checks','Reconciliation and configuration controls'],['audit','Audit Centre','Independent control evidence']]},
    {title:'Management & system',items:[['insights','Insights','Management intelligence'],['reports','Reports & Analytics','Executive and operational reporting'],['health','System Health','Reliability, queues and safe auto-recovery']]}
  ];}

  function ensureAutomationCentre94(){
    let nav=document.querySelector('.nav-item[data-view="automation"]'),view=$('view-automation');const dashboardNav=document.querySelector('.nav-item[data-view="dashboard"]');
    if(!nav&&dashboardNav){nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.dataset.view='automation';nav.innerHTML='<span>⚙</span> Automation Centre';dashboardNav.insertAdjacentElement('afterend',nav);nav.addEventListener('click',()=>switchView('automation'));}
    if(nav)nav.hidden=false;meta.automation=['Automation first','Automation Centre','Work that needs you, processes that run themselves, and every feature organized by workflow.'];
    if(!view){view=document.createElement('div');view.id='view-automation';view.className='view';const dashboard=$('view-dashboard');if(dashboard)dashboard.insertAdjacentElement('afterend',view);else document.querySelector('.content')?.prepend(view);}
    return view;
  }

  function renderAutomationCentre94(){
    const view=ensureAutomationCentre94();if(!view)return;const tasks=automationTasks94(),authority=authorityLabel(functionalAuthority(effectiveUserOrg(controlUser()||{}))),groups=automationFeatureGroups94().map(g=>({...g,items:g.items.filter(([v])=>automationViewAllowed94(v))})).filter(g=>g.items.length);
    const automations=[['Work → recovery evidence','Clock-out captures elapsed work and creates linked recovery evidence automatically.'],['Budget → controls','Excel budgets, rates and donor rules are validated, staged and routed to the correct approvers.'],['Approved work → recovery','The Recovery Engine recalculates allowable cost from live approved data and active financial controls.'],['Role routing & notifications','Finance, HR, managers and Country Directors see work only when it reaches their authority.'],['System resilience','Jivan monitors stale background tasks and can safely requeue recoverable work automatically.']];
    view.innerHTML=`<section class="automation-hero94 panel"><div><span class="section-kicker">Automation first</span><h2>Less administration. More decisions.</h2><p>Assurance Regent moves information between modules automatically. Users step in for judgment, approval and exceptions—not repetitive re-entry.</p></div><div class="automation-role94"><small>Your role</small><b>${esc(authority)}</b><span>${tasks.length?`${tasks.length} item${tasks.length===1?'':'s'} need your attention`:'No pending action in your current scope'}</span></div></section><section class="automation-kpis94"><article class="kpi-card ${tasks.length?'warn':'good'}"><small>Needs your action</small><b>${tasks.length}</b><span>Role-scoped work queue</span></article><article class="kpi-card good"><small>Automated flows</small><b>${automations.length}</b><span>Running around human approvals</span></article><article class="kpi-card"><small>Background refresh</small><b>ON</b><span>Queues refresh while the app is active</span></article><article class="kpi-card"><small>Last synchronized</small><b>${automationLastSync94?new Date(automationLastSync94).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Now'}</b><span>Live operational state</span></article></section><section class="panel automation-queue94"><div class="panel-head"><div><span class="section-kicker">My work</span><h3>What needs you next</h3></div><button type="button" class="btn small ghost" data-automation-refresh94>Refresh</button></div><div class="automation-task-list94">${tasks.length?tasks.slice(0,5).map((t,i)=>`<article><div class="automation-task-index94">${i+1}</div><div><small>${esc(t.kind)}</small><b>${esc(t.title)}</b><span>${esc(t.detail||'')}</span></div><button type="button" class="btn micro ${i===0?'primary':'ghost'}" data-automation-target94="${esc(t.target||'')}" data-automation-panel94="${esc(t.panel||'')}">${esc(t.label||'Open')}</button></article>`).join(''):'<div class="table-empty"><b>You are caught up</b><span>The system will surface work here automatically when a process reaches your role.</span></div>'}</div>${tasks.length>5?`<div class="automation-more94">${tasks.length-5} more item(s) are available in their source modules.</div>`:''}</section><section class="panel"><div class="panel-head"><div><span class="section-kicker">Running automatically</span><h3>Processes the system handles for you</h3></div></div><div class="automation-running94">${automations.map(([t,d])=>`<article><span class="automation-check94">✓</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></article>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><span class="section-kicker">Feature map</span><h3>Everything organized by workflow</h3></div></div><div class="automation-feature-groups94">${groups.map(g=>`<section><h4>${esc(g.title)}</h4><div>${g.items.map(([v,t,d])=>`<button type="button" data-automation-target94="${esc(v)}"><b>${esc(t)}</b><span>${esc(d)}</span><em>Open →</em></button>`).join('')}</div></section>`).join('')}</div></section>`;
    view.querySelector('[data-automation-refresh94]')?.addEventListener('click',()=>automationRefresh94(true));view.querySelectorAll('[data-automation-target94],[data-automation-panel94]').forEach(btn=>btn.addEventListener('click',()=>automationOpen94(btn.dataset.automationTarget94||'',btn.dataset.automationPanel94||'')));
  }

  const refreshCurrentBase94=refreshCurrent;
  refreshCurrent=function(){const result=refreshCurrentBase94();if(state.view==='automation')renderAutomationCentre94();if(state.view==='work')automationPrefillWork94();return result;};

  const renderDashboardRequestsBase94=renderDashboardRequests;
  renderDashboardRequests=function(){
    const body=$('dashRequestsBody');if(!body)return renderDashboardRequestsBase94();const rows=dashboardRequestRows(),table=body.closest('table'),head=table?.querySelector('thead tr');if(head&&!head.querySelector('[data-automation-action-head94]'))head.insertAdjacentHTML('beforeend','<th data-automation-action-head94>Action</th>');
    body.innerHTML=rows.length?rows.map(r=>{const [target,label]=automationRequestTarget94(r.type);return `<tr><td>${r.person?userIdentity(r.person,'',r.person.employeeId,'xs'):esc(r.name||'System')}</td><td>${esc(r.period||'')}</td><td>${esc(r.type)}</td><td>${resultChip(r.status)}</td><td>${esc(String(r.date||'').slice(0,10))}</td><td class="wrap">${esc(r.note||'')}</td><td><button type="button" class="btn micro ghost" data-dashboard-open94="${esc(target)}">${esc(label)}</button></td></tr>`;}).join(''):'<tr class="empty-row"><td colspan="7"><div class="table-empty"><b>No live requests requiring attention</b><span>The system will route payroll reviews, leave requests, recovery issues and active sessions here automatically.</span></div></td></tr>';body.querySelectorAll('[data-dashboard-open94]').forEach(btn=>btn.addEventListener('click',()=>automationOpen94(btn.dataset.dashboardOpen94)));paginateTable('dashRequestsBody',true);
  };

  function automationUserContext94(){const u=effectiveUserOrg(controlUser()||{}),e=leaveActorEmployee()||employeeRecord(u.id,u.name)||u;return {user:u,employee:e};}
  function automationProjectKey94(){const {user}=automationUserContext94();return `assurance-regent:last-work-project:${currentCompanyId()}:${String(user.id||user.email||'user').toLowerCase()}`;}
  function automationPrefillWork94(){
    if(state.view!=='work')return;const {user,employee}=automationUserContext94(),id=$('mtsEmployee'),name=$('mtsEmployeeName'),dept=$('mtsDepartment'),project=$('mtsProject');if(id&&!id.value.trim())id.value=employee?.employeeId||user.id||'';if(name&&!name.value.trim())name.value=employee?.name||user.name||'';
    if(dept&&!dept.value&&employee?.department){const option=[...dept.options].find(o=>String(o.value).toLowerCase()===String(employee.department).toLowerCase()||String(o.textContent||'').toLowerCase()===String(employee.department).toLowerCase());if(option)dept.value=option.value;}
    const last=localGet(automationProjectKey94());if(project&&!project.value.trim()&&last)project.value=last;if(project&&!project.dataset.automationRemember94){project.dataset.automationRemember94='1';const remember=()=>{const v=project.value.trim();if(v)localSet(automationProjectKey94(),v);};project.addEventListener('change',remember);project.addEventListener('blur',remember);}
  }
  function automationPrefillTime94(){
    const {user,employee}=automationUserContext94(),employeeSelect=$('scenarioEmployee'),projectSelect=$('scenarioProject'),date=$('scenarioDate'),last=localGet(automationProjectKey94());if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);const employeeId=String(employee?.employeeId||user.id||'');if(employeeSelect&&employeeId&&[...employeeSelect.options].some(o=>String(o.value)===employeeId))employeeSelect.value=employeeId;if(projectSelect&&last&&[...projectSelect.options].some(o=>String(o.value)===last))projectSelect.value=last;
  }

  async function automationRefresh94(manual=false){
    if(automationRefreshBusy94||!browserSessionToken||document.hidden)return;automationRefreshBusy94=true;try{const jobs=[];if(typeof refreshControlCenter==='function')jobs.push(refreshControlCenter());if(typeof loadLeaveData==='function')jobs.push(loadLeaveData(true));if(recruitmentHrAllowed())jobs.push(loadRecruitmentBundle(true).catch(()=>null));if(typeof budgetImportClientEligible85==='function'&&budgetImportClientEligible85())jobs.push(loadBudgetImport85(true).catch(()=>null));if(state.view==='exceptions')jobs.push(loadRecoveryExceptionContext().catch(()=>null));if(state.view==='health'&&systemHealthAllowed())jobs.push(loadSystemHealth(true).catch(()=>null));await Promise.allSettled(jobs);automationLastSync94=Date.now();const active=document.activeElement,typing=active&&['INPUT','TEXTAREA','SELECT'].includes(active.tagName)&&!active.closest('.global-search'),dialogOpen=Boolean(document.querySelector('dialog[open]'));if(!typing&&!dialogOpen)refreshCurrent();else if(state.view==='automation')renderAutomationCentre94();if(manual)toast('Automation Centre synchronized with live data.');}finally{automationRefreshBusy94=false;}
  }
  function startAutomationRefresh94(){setTimeout(()=>automationRefresh94(false).catch(()=>{}),5000);setInterval(()=>{if(isClientLeader())automationRefresh94(false).catch(()=>{});},AUTOMATION_REFRESH_MS94);}
  function bindAutomationUx94(){ensureAutomationCentre94();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&browserSessionToken)automationRefresh94(false).catch(()=>{});});window.addEventListener('assurance-regent-session-ready',()=>{automationLastSync94=Date.now();ensureAutomationCentre94();automationPrefillWork94();renderAutomationCentre94();automationRefresh94(false).catch(()=>{});});window.addEventListener('assurance-regent-view-change',()=>{if(state.view==='work')automationPrefillWork94();if(state.view==='automation')renderAutomationCentre94();});$('newTimeBtn')?.addEventListener('click',()=>setTimeout(automationPrefillTime94,0));}
  bindAutomationUx94();startAutomationRefresh94();window.AssuranceRegentAutomationFirst={version:AUTOMATION_FIRST_UX_SCHEMA94,tasks:automationTasks94,refresh:automationRefresh94,open:automationOpen94};
  /* Assurance Regent v6.3.94 — automation-first role work centre END */
