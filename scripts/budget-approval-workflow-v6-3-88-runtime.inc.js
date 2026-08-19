  /* Assurance Regent v6.3.88 — budget maker/checker/approver workflow + notifications START */
  const BUDGET_APPROVAL_SCHEMA88='6.3.88';
  let lastBudgetNotificationCount88=-1;

  function budgetWorkflowDescriptor88(user=controlUser?.()||{}){
    return `${user?.position||''} ${user?.department||''} ${user?.supervisoryRole||''} ${user?.role||''}`.toLowerCase();
  }
  function budgetFinanceMaker88(user=controlUser?.()||{}){
    const authority=functionalAuthority?.(effectiveUserOrg?.(user)||user)||'',text=budgetWorkflowDescriptor88(user);
    if(authority==='DEVELOPER')return true;
    return /(accountant|accounting officer|accounts officer|accounts assistant|finance officer|finance assistant|finance analyst|budget officer|grants accountant|project accountant)/i.test(text)
      && !/(finance manager|finance director|head of finance|chief financial officer|\bcfo\b)/i.test(text);
  }
  function budgetFinanceReviewer88(user=controlUser?.()||{}){
    const authority=functionalAuthority?.(effectiveUserOrg?.(user)||user)||'',text=budgetWorkflowDescriptor88(user);
    return authority==='DEVELOPER'||authority==='FINANCE_MANAGER'||/(finance manager|finance director|head of finance|chief financial officer|\bcfo\b)/i.test(text);
  }
  function budgetCountryApprover88(user=controlUser?.()||{}){
    const authority=functionalAuthority?.(effectiveUserOrg?.(user)||user)||'',text=budgetWorkflowDescriptor88(user);
    return authority==='DEVELOPER'||authority==='CEO'||/(country director|country representative|country lead)/i.test(text);
  }
  function budgetReadOnly88(user=controlUser?.()||{}){
    const authority=functionalAuthority?.(effectiveUserOrg?.(user)||user)||'';
    return authority==='AUDITOR';
  }

  // The feature must survive the global RBAC pass for only its legitimate business participants.
  const previewPermissionsBase88=previewPermissions;
  previewPermissions=function(role,user={}){
    const permissions=previewPermissionsBase88(role,user),allowed=Array.isArray(permissions?.allowedViews)?permissions.allowedViews:[];
    if(allowed.includes('*'))return permissions;
    const effective={...(user||{}),role:role||user?.role};
    if(!(budgetFinanceMaker88(effective)||budgetFinanceReviewer88(effective)||budgetCountryApprover88(effective)||budgetReadOnly88(effective)))return permissions;
    return {...permissions,allowedViews:[...new Set([...allowed,BUDGET_IMPORT_VIEW85])]};
  };

  budgetImportClientEligible85=function(){
    const user=controlUser?.()||{};
    return budgetFinanceMaker88(user)||budgetFinanceReviewer88(user)||budgetCountryApprover88(user)||budgetReadOnly88(user);
  };

  function ensureBudgetWorkflowUx88(view){
    if(!view)return view;
    const bundle=budgetImportBundle85||{},user=controlUser?.()||{};
    const canUpload=bundle&&Object.prototype.hasOwnProperty.call(bundle,'canUpload')?Boolean(bundle.canUpload):budgetFinanceMaker88(user);
    const upload=view.querySelector('[data-budget-upload85]'),file=view.querySelector('[data-budget-file85]');
    if(upload){upload.hidden=!canUpload;upload.setAttribute('aria-hidden',canUpload?'false':'true');}
    if(file)file.disabled=!canUpload;
    const hero=view.querySelector('.budget-import-hero85 p');
    if(hero)hero.textContent='Finance Office uploads and validates the workbook. Finance Manager performs the independent financial review, then Country Director gives final approval and activation.';
    const flow=view.querySelector('.budget-import-flow85');
    if(flow)flow.innerHTML='<article><small>1 · Maker</small><b>Finance Officer / Accountant uploads</b><span>Workbook data is staged; the maker cannot approve it.</span></article><article><small>2 · Validation</small><b>System validates the batch</b><span>Personnel IDs, values, dates, currency and donor rules are checked.</span></article><article><small>3 · Checker</small><b>Finance Manager reviews</b><span>Approve to Country Director or return for correction.</span></article><article><small>4 · Approver</small><b>Country Director approves & activates</b><span>Approve, return, or reject. Only an approved version becomes active.</span></article>';
    let badge=view.querySelector('[data-budget-workflow-role88]');
    const actions=view.querySelector('.budget-import-actions85');
    if(actions&&!badge){badge=document.createElement('span');badge.dataset.budgetWorkflowRole88='1';badge.className='budget-import-status85';actions.prepend(badge);}
    if(badge){const role=String(bundle.workflowRole||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());badge.textContent=role|| (budgetFinanceMaker88(user)?'Finance Office':budgetFinanceReviewer88(user)?'Finance Manager':budgetCountryApprover88(user)?'Country Director':'Read Only');}
    return view;
  }

  const ensureBudgetImportViewBase88=ensureBudgetImportView85;
  ensureBudgetImportView85=function(){return ensureBudgetWorkflowUx88(ensureBudgetImportViewBase88());};

  const renderBudgetImportBase88=renderBudgetImport85;
  renderBudgetImport85=function(error=null){
    renderBudgetImportBase88(error);const view=ensureBudgetWorkflowUx88($(`view-${BUDGET_IMPORT_VIEW85}`));if(!view)return;
    view.querySelectorAll('[data-budget-action85="FINANCE_APPROVE"]').forEach(button=>button.textContent='Approve → Country Director');
    view.querySelectorAll('[data-budget-action85="RETURN"]').forEach(button=>button.textContent='Return for correction');
    view.querySelectorAll('[data-budget-action85="COUNTRY_APPROVE"]').forEach(button=>button.textContent='Approve & Activate');
    const bundle=budgetImportBundle85||{},rows=Array.isArray(bundle.batches)?bundle.batches:[],pageSize=typeof BUDGET_IMPORT_PAGE_SIZE86==='number'?BUDGET_IMPORT_PAGE_SIZE86:5,page=typeof budgetImportPage86==='number'?budgetImportPage86:1,start=(page-1)*pageSize,current=rows.slice(start,start+pageSize),uid=budgetImportUserId85();
    [...(view.querySelectorAll('#budgetImportBatches85 tr')||[])].forEach((tr,index)=>{
      const row=current[index];if(!row)return;
      const countryReady=Boolean(bundle.canCountryApprove)&&row.status==='PENDING_COUNTRY_DIRECTOR'&&String(row.uploaded_by)!==uid&&String(row.finance_reviewed_by||'')!==uid;
      const actions=tr.querySelector('.budget-import-batch-actions85');
      if(countryReady&&actions&&!actions.querySelector('[data-budget-country-return88]')){
        const reject=actions.querySelector('[data-budget-action85="REJECT"]'),button=document.createElement('button');button.type='button';button.className='btn micro ghost';button.dataset.budgetAction85='RETURN';button.dataset.budgetId85=String(row.id||'');button.dataset.budgetCountryReturn88='1';button.textContent='Return for correction';
        if(reject)actions.insertBefore(button,reject);else actions.appendChild(button);
      }
    });
  };

  function mergeBudgetImportNotificationsIntoControl88(){
    if(!state.control||!budgetImportClientEligible85())return;
    const base=(state.control.notifications||[]).filter(n=>n.kind!=='budget_import'),items=(Array.isArray(budgetImportBundle85?.notifications)?budgetImportBundle85.notifications:[]).map(n=>({
      id:`budget:${n.id}`,kind:'budget_import',title:n.title||'Budget workflow update',detail:n.detail||'',notification_id:n.id,batch_id:n.batch_id,status:String(n.kind||'PENDING').replaceAll('_',' ')
    }));
    state.control.notifications=[...items,...base];
  }

  async function markBudgetImportNotification88(id){
    try{await supabaseRpc('assurance_regent_browser_budget_import_notification_read',{p_token:browserSessionToken,p_notification_id:Number(id)},{bypassCache:true});budgetImportBundle85=null;await refreshControlCenter();}
    catch(err){toast(err?.message||String(err));}
  }
  async function openBudgetImportNotification88(){closeControlDrawer?.();await openBudgetImportView85();}

  const renderControlDockBase88=renderControlDock;
  renderControlDock=function(){
    renderControlDockBase88();const c=state.control||defaultLocalControl(),u=c.profile?.currentUser,kinds=new Set(['advisor','task','review','account_approval','leave_approval','recruitment_application','budget_import']),count=u?(c.notifications||[]).filter(x=>kinds.has(String(x.kind||''))).length:0,budgetCount=u?(c.notifications||[]).filter(x=>x.kind==='budget_import').length:0,badge=$('notificationBadge');
    if(badge){badge.textContent=count>99?'99+':String(count);badge.hidden=count<=0;}
    if(u){if(lastBudgetNotificationCount88<0)lastBudgetNotificationCount88=budgetCount;else if(budgetCount>lastBudgetNotificationCount88)window.dispatchEvent(new CustomEvent('assurance-regent-notifications-change',{detail:{previous:lastBudgetNotificationCount88,count:budgetCount,items:(c.notifications||[]).filter(x=>x.kind==='budget_import').slice(0,8)}}));lastBudgetNotificationCount88=budgetCount;}else lastBudgetNotificationCount88=-1;
  };

  const renderNotificationsPaneBase88=renderNotificationsPane;
  renderNotificationsPane=function(){
    const c=state.control||defaultLocalControl(),original=Array.isArray(c.notifications)?c.notifications:[],budget=original.filter(n=>n.kind==='budget_import'),other=original.filter(n=>n.kind!=='budget_import');
    c.notifications=other;try{renderNotificationsPaneBase88();}finally{c.notifications=original;}
    const summary=$('notificationSummary'),list=$('notificationList');
    if(summary)summary.insertAdjacentHTML('afterbegin',`<article><small>Budget approvals</small><b>${budget.length}</b></article>`);
    if(!list||!budget.length)return;
    const html=budget.map(n=>`<article class="control-item"><span class="control-item-icon review">B</span><div class="control-item-main"><b>${esc(n.title)}</b><p>${esc(n.detail||'')}</p><small>${esc(n.status||'PENDING')}</small></div><div class="control-item-actions"><button class="btn small primary" data-budget-notification-open88="${encodeURIComponent(n.batch_id||'')}">Open budget</button><button class="btn small ghost" data-budget-notification-read88="${encodeURIComponent(n.notification_id||'')}">Mark read</button></div></article>`).join('');
    if(other.length)list.insertAdjacentHTML('afterbegin',html);else list.innerHTML=html;
    list.querySelectorAll('[data-budget-notification-open88]').forEach(button=>button.addEventListener('click',()=>void openBudgetImportNotification88(decodeURIComponent(button.dataset.budgetNotificationOpen88||''))));
    list.querySelectorAll('[data-budget-notification-read88]').forEach(button=>button.addEventListener('click',()=>void markBudgetImportNotification88(decodeURIComponent(button.dataset.budgetNotificationRead88||''))));
  };

  const refreshControlCenterBase88=refreshControlCenter;
  refreshControlCenter=async function(){
    await refreshControlCenterBase88();
    if(browserSessionToken&&budgetImportClientEligible85()){
      try{if(!budgetImportBundle85)await loadBudgetImport85(false);}catch(err){console.warn('Budget workflow notifications unavailable',err);}
    }
    mergeBudgetImportNotificationsIntoControl88();renderControlDock();if(state.controlPanel)renderControlPane(state.controlPanel);
  };

  const uploadBudgetWorkbookBase88=uploadBudgetWorkbook85;
  uploadBudgetWorkbook85=async function(file){const result=await uploadBudgetWorkbookBase88(file);try{await refreshControlCenter();}catch{}return result;};
  const decideBudgetBatchBase88=decideBudgetBatch85;
  decideBudgetBatch85=async function(id,action){const result=await decideBudgetBatchBase88(id,action);try{await refreshControlCenter();}catch{}return result;};

  window.AssuranceRegentBudgetWorkflow={version:BUDGET_APPROVAL_SCHEMA88,flow:['FINANCE_OFFICE','SYSTEM_VALIDATION','FINANCE_MANAGER','COUNTRY_DIRECTOR'],notificationKind:'budget_import'};
  /* Assurance Regent v6.3.88 — budget maker/checker/approver workflow + notifications END */
