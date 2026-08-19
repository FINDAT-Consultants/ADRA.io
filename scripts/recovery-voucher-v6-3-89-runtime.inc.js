  /* Assurance Regent v6.3.89 — Recovery Voucher live refresh + calculation START */
  const RECOVERY_VOUCHER_SCHEMA89='6.3.89';
  let recoveryVoucherBusy89=false;

  function voucherSelection89(){
    return {
      month:$('voucherMonth')?.value||state.month||'',
      project:$('voucherProject')?.value||'',
      employeeId:$('voucherEmployee')?.value||''
    };
  }

  function voucherEmpty89(title,detail){
    const host=$('voucherOutput');if(!host)return;
    host.innerHTML=`<div class="panel table-empty"><b>${esc(title)}</b><span>${esc(detail)}</span></div>`;
  }

  function renderRecoveryVoucher89(){
    const host=$('voucherOutput');if(!host)return null;
    const {month,project,employeeId}=voucherSelection89();
    if(!month){voucherEmpty89('Choose a reporting month','Select the month whose approved project time and payroll cost should be recovered.');return null;}
    if(!project){voucherEmpty89('Choose a project','Select a live project before calculating the recovery voucher.');return null;}
    if(!employeeId){voucherEmpty89('Choose an employee','No employee recovery record is currently available for this project and month.');return null;}
    try{
      const rb=recoveryBundle(),p=engine.recoveryPassport(month,project,{employeeId,rules:rb.rules||[],evidence:rb.evidence||[],currency:activeCurrency()});
      if(!p){voucherEmpty89('No live voucher can be calculated yet','The selected employee/project does not yet have the operational inputs required for a Recovery Passport.');return null;}
      const keys=['evidence','capacity','eligibility','budget','approval'],controls=Array.isArray(p.controls)?p.controls:[];
      const budgetSource=String(p.budgetSource||'LEGACY_PROJECT').replaceAll('_',' '),rateSource=String(p.rateSource||'PAYROLL').replaceAll('_',' ');
      host.innerHTML=`<div class="voucher-card"><section class="voucher-main"><div class="voucher-title"><div><span class="section-kicker">Recovery Passport</span><h2>${esc(p.projectCode)}</h2><div class="voucher-user">${userIdentity(p.employeeId||'',p.employee,`${window.ADRAEngine.monthLabel(p.reportingMonth)} · ${p.position||''}`,'sm')}</div></div><span class="voucher-status ${String(p.finalStatus||'BLOCKED').toLowerCase()}">${esc(p.finalStatus||'BLOCKED')}</span></div><div class="voucher-fields"><div class="voucher-field"><small>Approved project hours</small><b>${num(p.approvedProjectHours)}</b></div><div class="voucher-field"><small>Expected monthly hours</small><b>${num(p.expectedHours)}</b></div><div class="voucher-field"><small>Hourly cost</small><b>${money(p.hourlyCost)}</b></div><div class="voucher-field"><small>Raw proposed cost</small><b>${money(p.rawCost)}</b></div><div class="voucher-field"><small>Personnel budget</small><b>${money(p.budgetLimit)}</b></div><div class="voucher-field"><small>Amount at risk</small><b>${money(p.amountAtRisk)}</b></div><div class="voucher-field"><small>Budget source</small><b>${esc(budgetSource)}</b></div><div class="voucher-field"><small>Rate source</small><b>${esc(rateSource)}</b></div></div><div class="passport-gate"><div><small>Recovery Gate</small><b>${p.recoveryGate}</b></div><div><small>Recoverable cost</small><b>${money(p.recoverableCost)}</b></div></div></section><section class="passport-main"><div class="panel-head"><div><span class="section-kicker">Five-key control</span><h3>Recovery authorization</h3></div></div><div class="control-stack">${keys.map(k=>`<div class="control-row"><b>${k[0].toUpperCase()+k.slice(1)}</b>${resultChip(p.keys?.[k]||'REVIEW')}<small>${keyHelp(k,p)}</small></div>`).join('')}</div><div class="panel-head" style="margin-top:20px"><div><span class="section-kicker">Workbook voucher controls</span><h3>Posting checks</h3></div></div><div class="control-stack">${controls.map(c=>`<div class="control-row"><b>${esc(c.control)}</b>${resultChip(c.result)}<small>${esc(c.action)} · Value: ${esc(c.value)}</small></div>`).join('')||'<div class="control-row"><b>Posting checks</b><small>No posting checks are available yet.</small></div>'}</div></section></div>`;
      return p;
    }catch(err){
      console.error('Recovery Voucher calculation failed',err);voucherEmpty89('Recovery Voucher calculation failed',err?.message||String(err));return null;
    }
  }

  async function refreshVoucherLiveInputs89(){
    const selected=voucherSelection89();
    if(!browserSessionToken)throw new Error('Sign in before calculating a Recovery Voucher.');
    try{await flushStandaloneSave?.();}catch{}
    const snapshot=await supabaseRpc('assurance_regent_browser_read_state',{p_token:browserSessionToken},{bypassCache:true});
    if(snapshot?.live&&typeof snapshot.live==='object'){
      previewMemory.live=snapshot.live;
      engine.replaceState(snapshot.live);
    }
    state.month=selected.month||state.month;
    populateMonths();
    if(selected.month&&[...($('voucherMonth')?.options||[])].some(o=>o.value===selected.month))$('voucherMonth').value=selected.month;
    if(selected.month&&[...($('globalMonth')?.options||[])].some(o=>o.value===selected.month))$('globalMonth').value=selected.month;
    if(selected.project&&[...($('voucherProject')?.options||[])].some(o=>o.value===selected.project))$('voucherProject').value=selected.project;
    populateVoucherEmployees();
    if(selected.employeeId&&[...($('voucherEmployee')?.options||[])].some(o=>o.value===selected.employeeId))$('voucherEmployee').value=selected.employeeId;
    state.recoveryLoadedAt=0;state.recoveryExceptionLoadedAt=0;
    if(canUseRecoveryAssurance())await loadRecoveryAssurance(true);
    return voucherSelection89();
  }

  async function calculateRecoveryVoucher89(){
    if(recoveryVoucherBusy89)return null;
    const button=$('calculateVoucher'),oldText=button?.textContent||'Calculate voucher';recoveryVoucherBusy89=true;
    if(button){button.disabled=true;button.textContent='Calculating…';button.setAttribute('aria-busy','true');}
    try{
      await refreshVoucherLiveInputs89();
      const p=renderRecoveryVoucher89();
      if(!p)return null;
      if(String(p.finalStatus||'').toUpperCase()==='RECOVERABLE')toast(`Recovery Voucher calculated · ${money(p.recoverableCost)} recoverable.`);
      else toast(`Voucher calculated · ${money(p.rawCost)} proposed. Recovery remains blocked until the failed controls are cleared.`);
      return p;
    }catch(err){
      console.error('Recovery Voucher refresh failed',err);voucherEmpty89('Could not calculate the Recovery Voucher',err?.message||String(err));toast(err?.message||String(err));return null;
    }finally{
      recoveryVoucherBusy89=false;if(button){button.disabled=false;button.textContent=oldText;button.removeAttribute('aria-busy');}
    }
  }

  renderVoucher=function(){return renderRecoveryVoucher89();};
  bindVoucher=function(){
    const calculate=$('calculateVoucher'),month=$('voucherMonth'),project=$('voucherProject'),employee=$('voucherEmployee');
    if(calculate&&!calculate.dataset.voucherBound89){calculate.dataset.voucherBound89='1';calculate.type='button';calculate.addEventListener('click',e=>{e.preventDefault();void calculateRecoveryVoucher89();});}
    if(month&&!month.dataset.voucherBound89){month.dataset.voucherBound89='1';month.addEventListener('change',async e=>{state.month=e.target.value;if($('globalMonth'))$('globalMonth').value=state.month;state.recoveryLoadedAt=0;state.recoveryExceptionLoadedAt=0;populateVoucherEmployees();try{if(canUseRecoveryAssurance())await loadRecoveryAssurance(true);}catch(err){console.warn('Recovery Voucher month refresh unavailable',err);}renderRecoveryVoucher89();});}
    if(project&&!project.dataset.voucherBound89){project.dataset.voucherBound89='1';project.addEventListener('change',()=>{populateVoucherEmployees();renderRecoveryVoucher89();});}
    if(employee&&!employee.dataset.voucherBound89){employee.dataset.voucherBound89='1';employee.addEventListener('change',renderRecoveryVoucher89);}
  };

  window.AssuranceRegentRecoveryVoucher={version:RECOVERY_VOUCHER_SCHEMA89,calculate:calculateRecoveryVoucher89,refresh:refreshVoucherLiveInputs89};
  /* Assurance Regent v6.3.89 — Recovery Voucher live refresh + calculation END */
