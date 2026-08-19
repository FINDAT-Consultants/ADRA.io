  /* Assurance Regent v6.3.91 — live-data recovery + allowable-cost risk START */
  const RECOVERY_LIVE_DATA_SCHEMA91='6.3.91';

  function recoveryRuleValues91(row,key){
    const wanted=String(key||'').trim().toUpperCase();
    return (Array.isArray(row?.appliedRules)?row.appliedRules:[]).filter(r=>String(r?.rule_key??r?.ruleKey??'').trim().toUpperCase()===wanted);
  }
  function recoveryPositiveRule91(row,key){
    return recoveryRuleValues91(row,key).map(r=>Number(r?.numeric_value??r?.numericValue)).filter(n=>Number.isFinite(n)&&n>0);
  }
  function recoveryCurrencyRules91(row){
    return recoveryRuleValues91(row,'CURRENCY').map(r=>String(r?.text_value??r?.textValue??'').trim().toUpperCase()).filter(Boolean);
  }
  function recoveryRound91(value,places=2){const n=Number(value||0);return Number((Number.isFinite(n)?n:0).toFixed(places));}
  function recoveryDecision91(entry={}){return typeof recoveryEntryDecision90==='function'?recoveryEntryDecision90(entry):(/reject|declin|void|cancel|withdraw/i.test(String(entry.status||''))?'REJECTED':/approved/i.test(String(entry.status||''))?'APPROVED':'PENDING');}
  function recoveryEntries91(month,projectCode,employeeId){return typeof recoverySelectedEntries90==='function'?recoverySelectedEntries90(month,projectCode,employeeId):(engine?.state?.timeEntries||[]);}

  function recoveryLiveAllowable91(row,month,projectCode,employeeId){
    if(!row)return row;
    const entries=recoveryEntries91(month,projectCode||row.projectCode,employeeId||row.employeeId),approved=entries.filter(e=>recoveryDecision91(e)==='APPROVED'),rejected=entries.filter(e=>recoveryDecision91(e)==='REJECTED'),pending=entries.filter(e=>recoveryDecision91(e)==='PENDING');
    const approvedHours=recoveryRound91(approved.reduce((n,e)=>n+Math.max(0,Number(e?.hours||0)),0),6),employmentRate=Math.max(0,Number(row.hourlyCost||0)),rawCost=recoveryRound91(approvedHours*employmentRate,2),expected=Math.max(0,Number(row.expectedHours||0));
    const hourlyCaps=recoveryPositiveRule91(row,'MAX_HOURLY_COST'),donorHourlyCap=hourlyCaps.length?Math.min(...hourlyCaps):0,allowableHourlyRate=donorHourlyCap?Math.min(employmentRate,donorHourlyCap):employmentRate;
    const allowableHours=expected>0?Math.min(approvedHours,expected):0,capacityExcessHours=Math.max(0,approvedHours-allowableHours);
    const chargeCaps=recoveryPositiveRule91(row,'MAX_PERSONNEL_CHARGE'),chargeCap=chargeCaps.length?Math.min(...chargeCaps):0,budgetLimit=Math.max(0,Number(row.budgetLimit||0));
    const activeCode=String(activeCurrency?.()||'').trim().toUpperCase(),currencyRules=recoveryCurrencyRules91(row),currencyOk=!currencyRules.length||!activeCode||currencyRules.includes(activeCode);
    const keys={...(row.keys||{})},keyReasons={...(row.keyReasons||{})};
    keys.approval=approved.length&&pending.length===0?'PASS':'FAIL';
    keyReasons.approval=pending.length?`${pending.length} entry decision${pending.length===1?' is':'s are'} still pending; only Finance-approved work can be recovered.`:approved.length?`${approved.length} Finance-approved entr${approved.length===1?'y':'ies'} feed this calculation${rejected.length?`; ${rejected.length} rejected entr${rejected.length===1?'y contributes':'ies contribute'} zero`:''}.`:'No Finance-approved time remains for this voucher.';
    keys.capacity=expected>0&&approvedHours<=expected+.01?'PASS':'FAIL';
    keyReasons.capacity=expected>0?(keys.capacity==='PASS'?`${approvedHours} approved hours are within ${recoveryRound91(expected,6)} hours of live available capacity.`:`${approvedHours} approved hours exceed live capacity of ${recoveryRound91(expected,6)} hours; excess hours are not recoverable.`):'No live working-capacity hours are configured for this reporting period.';
    const budgetAvailable=budgetLimit>0&&currencyOk;
    keys.budget=budgetAvailable?'PASS':'FAIL';
    if(!budgetLimit)keyReasons.budget='No active approved personnel budget is available for this project.';
    else if(!currencyOk)keyReasons.budget=`The active currency ${activeCode||'is unavailable'} does not match the donor currency rule (${currencyRules.join(', ')}).`;
    else if(donorHourlyCap&&employmentRate>donorHourlyCap)keyReasons.budget=`Live employment cost is ${recoveryRound91(employmentRate,2)} per hour; the donor rule allows ${recoveryRound91(donorHourlyCap,2)} per hour. The allowable portion is recoverable and only the excess remains at risk.`;
    else keyReasons.budget=`The live proposed charge is tested against the active personnel budget of ${recoveryRound91(budgetLimit,2)}${chargeCap?` and charge ceiling of ${recoveryRound91(chargeCap,2)}`:''}.`;
    const hardPass=keys.evidence==='PASS'&&keys.eligibility==='PASS'&&keys.approval==='PASS'&&expected>0&&budgetAvailable&&employmentRate>0;
    let recoverable=hardPass?allowableHours*allowableHourlyRate:0;if(chargeCap>0)recoverable=Math.min(recoverable,chargeCap);if(budgetLimit>0)recoverable=Math.min(recoverable,budgetLimit);recoverable=Math.max(0,recoverable);
    const amountAtRisk=Math.max(0,rawCost-recoverable),recoveryRate=rawCost>0?recoverable/rawCost:0;
    let recoveryRisk='NO DATA';if(rawCost>0){if(!hardPass||recoverable<=0)recoveryRisk='HIGH';else if(recoveryRate>=.9)recoveryRisk='LOW';else if(recoveryRate>=.5)recoveryRisk='MEDIUM';else recoveryRisk='HIGH';}
    const gate=recoverable>0&&hardPass?1:0,recoveryMode=gate?(recoverable+0.01<rawCost?'PARTIAL':'FULL'):'BLOCKED';
    const controls=(Array.isArray(row.controls)?row.controls:[]).map(c=>{
      const name=String(c?.control||'');
      if(/approval/i.test(name))return {...c,result:keys.approval,action:keyReasons.approval,value:`${approved.length} approved · ${rejected.length} rejected · ${pending.length} pending`};
      if(/hours variance|capacity/i.test(name))return {...c,result:keys.capacity,action:keyReasons.capacity,value:`${approvedHours} approved / ${recoveryRound91(expected,6)} capacity`};
      if(/budget|personnel|posting authorization/i.test(name)&&gate)return {...c,result:'PASS',action:recoveryMode==='PARTIAL'?'Live donor/budget ceilings cap the recoverable portion; the excess remains at risk.':'Live allowable cost is within active financial controls.',value:recoveryRound91(recoverable,2)};
      return c;
    });
    return {...row,approvedProjectHours:approvedHours,hourlyCost:recoveryRound91(employmentRate,8),rawCost,keys,keyReasons,controls,recoveryGate:gate,recoverableCost:recoveryRound91(recoverable,2),amountAtRisk:recoveryRound91(amountAtRisk,2),finalStatus:gate?'RECOVERABLE':'BLOCKED',recoveryMode,recoveryRisk,recoveryRate:recoveryRound91(recoveryRate,6),allowableHourlyRate:recoveryRound91(allowableHourlyRate,8),donorHourlyCap:recoveryRound91(donorHourlyCap,8),allowableHours:recoveryRound91(allowableHours,6),capacityExcessHours:recoveryRound91(capacityExcessHours,6),approvedEntryCount:approved.length,rejectedEntryCount:rejected.length,pendingEntryCount:pending.length,recoveryBasis:'LIVE_APPROVED_DATA'};
  }

  if(engine?.recoveryPassport&&!engine.recoveryPassport.__liveData91){const base=engine.recoveryPassport.bind(engine),wrapped=function(month,projectCode,options={}){return recoveryLiveAllowable91(base(month,projectCode,options),month,projectCode,options.employeeId||'');};wrapped.__liveData91=true;engine.recoveryPassport=wrapped;}
  if(engine?.recoveryPassports&&!engine.recoveryPassports.__liveData91){const base=engine.recoveryPassports.bind(engine),wrapped=function(month,options={}){return (base(month,options)||[]).map(row=>recoveryLiveAllowable91(row,month,row?.projectCode,row?.employeeId));};wrapped.__liveData91=true;engine.recoveryPassports=wrapped;}

  const recoveryAuditTestsBase91=typeof recoveryAuditTests==='function'?recoveryAuditTests:null;
  if(recoveryAuditTestsBase91){recoveryAuditTests=function(){
    const base=recoveryAuditTestsBase91()||[],rows=recoveryComputedPassports(),month=String(state.month||''),entries=(engine.state.timeEntries||[]).filter(e=>String(e.month||'')===month),pending=entries.filter(e=>recoveryDecision91(e)==='PENDING').length,raw=rows.reduce((n,r)=>n+Number(r.rawCost||0),0),riskAmount=rows.reduce((n,r)=>n+Number(r.amountAtRisk||0),0),exposure=raw>0?riskAmount/raw:0;
    return base.map(t=>{let exceptions=Number(t.exceptions||0);if(t.name==='Approval completeness')exceptions=pending;if(t.name==='Five-key Recovery Gate')exceptions=rows.filter(r=>r.finalStatus==='BLOCKED').length;if(t.name==='Project personnel budget')exceptions=rows.filter(r=>Number(r.budgetLimit||0)<=0).length;if(t.name==='Time-entry bounds')exceptions=entries.filter(e=>Number(e.hours)<=0||Number(e.hours)>24).length;const result=exceptions?'FAIL':'PASS';let risk='LOW';if(result==='FAIL'){const critical=/Project eligibility|Payroll configuration|Source reconciliation|Immutable snapshot hashes|Journal balance/.test(t.name);risk=critical||exposure>=.5||exceptions>=5?'HIGH':'MEDIUM';}return {...t,exceptions,result,risk,action:t.name==='Approval completeness'?'Resolve only entries still awaiting a Finance decision; rejected work is excluded from recovery.':t.name==='Time-entry bounds'?'Correct impossible live durations. System-measured fractional hours are valid and are not forced into spreadsheet quarter-hour increments.':t.action};});
  };}

  const renderRecoveryVoucherBase91=typeof renderRecoveryVoucher89==='function'?renderRecoveryVoucher89:null;
  if(renderRecoveryVoucherBase91){renderRecoveryVoucher89=function(){const p=renderRecoveryVoucherBase91();if(!p)return p;const host=$('voucherOutput'),fields=host?.querySelector('.voucher-fields');if(fields){fields.insertAdjacentHTML('beforeend',`<div class="voucher-field"><small>Allowable hourly rate</small><b>${money(p.allowableHourlyRate??p.hourlyCost)}</b></div><div class="voucher-field"><small>Recovery basis</small><b>${esc(p.recoveryMode==='PARTIAL'?'Partial allowable cost':'Live approved data')}</b></div><div class="voucher-field"><small>Recovery risk</small><b>${esc(p.recoveryRisk||'NO DATA')}</b></div>`);}const status=host?.querySelector('.voucher-status');if(status&&p.recoveryMode==='PARTIAL')status.textContent='RECOVERABLE · PARTIAL';return p;};renderVoucher=function(){return renderRecoveryVoucher89();};}

  window.AssuranceRegentRecoveryLiveData={version:RECOVERY_LIVE_DATA_SCHEMA91,calculate:recoveryLiveAllowable91};
  /* Assurance Regent v6.3.91 — live-data recovery + allowable-cost risk END */
