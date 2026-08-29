  /* Assurance Regent v6.3.92 — Recovery Exceptions live financial exposure START */
  const RECOVERY_EXCEPTIONS_LIVE_SCHEMA92='6.3.92';

  function recoveryApprovedWorkRate92(month,employeeId,row={}){
    const entries=recoveryEntries91(month,row?.projectCode||'',employeeId).filter(e=>recoveryDecision91(e)==='APPROVED'),approvedHours=entries.reduce((n,e)=>n+Math.max(0,Number(e?.hours||0)),0);
    if(!(approvedHours>0))return null;
    let pricedHours=0,totalCost=0;const currencies=new Set();
    for(const entry of entries){
      const hours=Math.max(0,Number(entry?.hours||0));if(!(hours>0))continue;
      const currency=String(entry?.costCurrency||'').trim().toUpperCase();if(currency)currencies.add(currency);
      const operational=Number(entry?.operationalCost),hourly=Number(entry?.hourlyRate);let cost=0;
      if(Number.isFinite(operational)&&operational>0)cost=operational;
      else if(Number.isFinite(hourly)&&hourly>0)cost=hours*hourly;
      if(cost>0){pricedHours+=hours;totalCost+=cost;}
    }
    const activeCode=String(activeCurrency?.()||'').trim().toUpperCase(),currencyOk=currencies.size<=1&&(!activeCode||currencies.size===0||currencies.has(activeCode));
    if(!currencyOk||Math.abs(pricedHours-approvedHours)>.0001||!(totalCost>0))return null;
    return {rate:totalCost/approvedHours,source:'APPROVED_WORK_ACTUAL',allocableCost:totalCost,pricedHours:approvedHours,currency:[...currencies][0]||activeCode||''};
  }

  const recoveryPayrollRateBase92=recoveryPayrollRate91;
  recoveryPayrollRate91=function(month,employeeId,expected,row={}){
    if(String(row?.rateSource||'').trim().toUpperCase()==='APPROVED_IMPORT')return recoveryPayrollRateBase92(month,employeeId,expected,row);
    const actual=recoveryApprovedWorkRate92(month,employeeId,row);if(actual)return actual;
    return recoveryPayrollRateBase92(month,employeeId,expected,row);
  };

  function recoveryScopedRows92(){
    const b=recoveryExceptionContext(),authority=recoveryAuthority(),ids=managedEmployeeIdSet(controlUser()||{});let rows=engine.recoveryPassports(state.month,{rules:b.rules||[],evidence:b.evidence||[],currency:activeCurrency()});
    if(!['DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR'].includes(authority))rows=rows.filter(r=>ids.has(String(r.employeeId||'').trim().toLowerCase())||ids.has(String(r.employee||'').trim().toLowerCase()));
    return rows;
  }
  function recoveryAttention92(row){return row?.finalStatus==='BLOCKED'||row?.recoveryMode==='PARTIAL'||Number(row?.amountAtRisk||0)>.01||Object.values(row?.keys||{}).some(v=>v!=='PASS');}
  recoveryExceptionRows=function(){return recoveryScopedRows92().filter(recoveryAttention92);};

  function recoveryExposure92(row){
    const failed=recoveryFailedKeys(row),risk=Number(row?.amountAtRisk||0),partial=row?.recoveryMode==='PARTIAL'||risk>.01;
    if(failed.length)return {keys:failed.join(', '),exception:failed.map(k=>row?.keyReasons?.[k.toLowerCase()]||'').filter(Boolean).join(' · '),owner:row?.remediation?.[0]?.owner||'Management',action:row?.remediation?.[0]?.action||'Review and resolve the failed live recovery control.',status:row?.finalStatus||'BLOCKED'};
    if(partial)return {keys:'Allowable cost ceiling',exception:`${money(risk)} of approved live cost is outside the current donor/budget allowance.`,owner:'Finance',action:'Review the live donor or budget ceiling; recover the allowable portion and retain only the excess as risk.',status:'PARTIAL'};
    return {keys:'—',exception:'No live recovery exception.',owner:'—',action:'No action required.',status:row?.finalStatus||'RECOVERABLE'};
  }

  renderRecoveryExceptionDetail=function(row){
    const el=$('recoveryExceptionDetail');if(!el)return;
    if(!row){const all=recoveryScopedRows92(),recoverable=all.reduce((n,r)=>n+Number(r.recoverableCost||0),0),risk=all.reduce((n,r)=>n+Number(r.amountAtRisk||0),0);el.innerHTML=`<div class="table-empty"><b>No management exception selected</b><span>Live scoped recovery: ${esc(money(recoverable))} recoverable · ${esc(money(risk))} at risk.</span></div>`;return;}
    const failed=recoveryFailedKeys(row),exposure=recoveryExposure92(row),rem=row.remediation||[],status=exposure.status;
    el.innerHTML=`<div class="recovery-passport-head"><div><span class="section-kicker">Management exception</span><h3>${esc(row.employee)} · ${esc(row.projectCode)}</h3><small>${esc(window.ADRAEngine.monthLabel(row.reportingMonth))} · ${esc(row.projectName||row.donor||'')}</small></div>${resultChip(status)}</div><div class="recovery-passport-summary supervisor-safe"><article><small>Approved project hours</small><b>${num(row.approvedProjectHours)}</b></article><article><small>Recoverable value</small><b>${money(row.recoverableCost)}</b></article><article><small>Amount at risk</small><b>${money(row.amountAtRisk)}</b></article><article><small>Recovery rate</small><b>${pct(Number(row.recoveryRate||0))}</b></article></div>${failed.length?`<div class="recovery-key-grid">${failed.map(k=>{const key=k.toLowerCase();return `<article class="recovery-key-card"><b>${esc(k)}${resultChip(row.keys[key])}</b><small>${esc(row.keyReasons?.[key]||keyHelp(key,row))}</small></article>`;}).join('')}</div>`:`<div class="recovery-key-grid"><article class="recovery-key-card"><b>Allowable cost${resultChip(status)}</b><small>${esc(exposure.exception)}</small></article></div>`}<div><span class="section-kicker">Required action</span><div class="recovery-remediation">${rem.length?rem.map(x=>`<article><b>${esc(x.owner)}</b><span>${esc(x.action)}</span></article>`).join(''):`<article><b>${esc(exposure.owner)}</b><span>${esc(exposure.action)}</span></article>`}</div></div><div class="notice blue"><b>Live management view</b><span>Amounts come from current approved work, active donor/budget controls and current recovery decisions. Payroll rates and accounting formulas remain hidden from this management-by-exception view.</span></div>`;
  };

  renderRecoveryExceptions=async function(){
    if(!canUseRecoveryExceptions())return;await loadRecoveryExceptionContext();const all=recoveryScopedRows92(),rows=all.filter(recoveryAttention92),recoverable=all.reduce((n,r)=>n+Number(r.recoverableCost||0),0),risk=all.reduce((n,r)=>n+Number(r.amountAtRisk||0),0),gaps=all.filter(r=>r.keys?.evidence!=='PASS'||r.keys?.eligibility!=='PASS').length;
    if($('recoveryExceptionsKpis'))$('recoveryExceptionsKpis').innerHTML=[['Recoverable now',money(recoverable),'Approved live cost currently allowable',recoverable?'good':''],['Amount at risk',money(risk),'Blocked or capped live cost',risk?'bad':'good'],['Items needing action',rows.length,'Blocked, partial or failed controls',rows.length?'warn':'good'],['Evidence / eligibility gaps',gaps,'Live control gaps requiring correction',gaps?'bad':'good']].map(x=>`<article class="kpi-card ${x[3]}"><small>${esc(x[0])}</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></article>`).join('');
    if($('recoveryExceptionsBody'))$('recoveryExceptionsBody').innerHTML=rows.length?rows.map(r=>{const x=recoveryExposure92(r);return `<tr data-exception-key="${encodeURIComponent(recoveryRowKey(r))}"><td>${userIdentity(r.employeeId,r.employee,r.position||r.employeeId,'xs')}</td><td><b>${esc(r.projectCode)}</b><small>${esc(r.projectName||r.donor||'')}</small></td><td>${esc(x.keys)}</td><td class="wrap">${esc(x.exception)}</td><td>${esc(x.owner)}</td><td class="wrap">${esc(x.action)}</td><td>${resultChip(x.status)}</td></tr>`;}).join(''):`<tr class="empty-row"><td colspan="7"><div class="table-empty"><b>No management recovery exceptions in this period</b><span>${esc(money(recoverable))} is currently recoverable from live approved work · ${esc(money(risk))} is at risk.</span></div></td></tr>`;
    paginateTable('recoveryExceptionsBody',true);const selected=rows.find(r=>recoveryRowKey(r)===state.recoveryExceptionSelectedKey)||rows[0]||null;if(selected)state.recoveryExceptionSelectedKey=recoveryRowKey(selected);renderRecoveryExceptionDetail(selected);
  };

  window.AssuranceRegentRecoveryExceptionsLive={version:RECOVERY_EXCEPTIONS_LIVE_SCHEMA92,approvedWorkRate:recoveryApprovedWorkRate92,scopedRows:recoveryScopedRows92};
  /* Assurance Regent v6.3.92 — Recovery Exceptions live financial exposure END */
