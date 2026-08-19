  /* Assurance Regent v6.3.90 — approved-work recovery + rejected-entry exclusion START */
  const RECOVERY_APPROVED_WORK_SCHEMA90='6.3.90';

  function recoveryMonthKey90(value=''){
    const raw=String(value||'').trim();
    if(/^\d{4}-\d{2}/.test(raw))return `${raw.slice(0,7)}-01`;
    try{const d=new Date(raw);if(Number.isFinite(d.getTime()))return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-01`;}catch{}
    return raw;
  }
  function recoveryEntryDecision90(entry={}){
    const text=[entry.status,entry.approvalStatus,entry.financeApproval,entry.financeStatus,entry.reviewStatus].filter(Boolean).join(' ').trim();
    if(/\b(reject(?:ed|ion)?|declin(?:ed)?|void(?:ed)?|cancel(?:led|ed)?|withdrawn)\b/i.test(text))return 'REJECTED';
    if(/\bfinance\s*approved\b|\bapproved\b/i.test(text))return 'APPROVED';
    return 'PENDING';
  }
  function recoverySelectedEntries90(month,projectCode,employeeId){
    const selected=recoveryMonthKey90(month),project=String(projectCode||'').trim().toUpperCase(),employee=String(employeeId||'').trim();
    return (Array.isArray(engine?.state?.timeEntries)?engine.state.timeEntries:[]).filter(e=>recoveryMonthKey90(e?.month||e?.date)===selected&&String(e?.projectCode||'').trim().toUpperCase()===project&&String(e?.employeeId||'').trim()===employee);
  }
  function recoveryPositiveLimit90(row){
    const limits=[];
    const budget=Number(row?.budgetLimit||0);if(Number.isFinite(budget)&&budget>0)limits.push(budget);
    for(const rule of (Array.isArray(row?.appliedRules)?row.appliedRules:[])){
      if(String(rule?.rule_key??rule?.ruleKey??'').trim().toUpperCase()!=='MAX_PERSONNEL_CHARGE')continue;
      const n=Number(rule?.numeric_value??rule?.numericValue);if(Number.isFinite(n)&&n>0)limits.push(n);
    }
    return limits.length?Math.min(...limits):0;
  }
  function repairApprovedWorkRecovery90(row,month,projectCode,employeeId){
    if(!row)return row;
    const entries=recoverySelectedEntries90(month,projectCode||row.projectCode,employeeId||row.employeeId),approved=entries.filter(e=>recoveryEntryDecision90(e)==='APPROVED'),rejected=entries.filter(e=>recoveryEntryDecision90(e)==='REJECTED'),pending=entries.filter(e=>recoveryEntryDecision90(e)==='PENDING');
    const keys={...(row.keys||{})},keyReasons={...(row.keyReasons||{})};
    if(approved.length&&pending.length===0){
      keys.approval='PASS';
      keyReasons.approval=`${approved.length} Finance-approved entr${approved.length===1?'y is':'ies are'} eligible for recovery${rejected.length?`; ${rejected.length} rejected entr${rejected.length===1?'y is':'ies are'} excluded and contribute zero`:''}.`;
    }else if(pending.length){
      keys.approval='FAIL';
      keyReasons.approval=`${pending.length} entr${pending.length===1?'y still requires':'ies still require'} a Finance decision before recovery. ${approved.length} approved entr${approved.length===1?'y is':'ies are'} retained; rejected entries remain excluded.`;
    }else{
      keys.approval='FAIL';
      keyReasons.approval=rejected.length?'No Finance-approved entry remains for this voucher; rejected entries are excluded from recovery.':'No Finance-approved entry exists for this voucher yet.';
    }
    const fiveKeys=['evidence','capacity','eligibility','budget','approval'],gate=fiveKeys.every(k=>keys[k]==='PASS')?1:0,raw=Number(row.rawCost||0),limit=recoveryPositiveLimit90(row),recoverable=gate?Math.min(raw,limit||raw):0;
    const controls=(Array.isArray(row.controls)?row.controls:[]).map(c=>/approval/i.test(String(c?.control||''))?{...c,result:keys.approval,action:keyReasons.approval,value:`${approved.length} approved · ${rejected.length} rejected · ${pending.length} pending`}:c);
    return {...row,keys,keyReasons,controls,recoveryGate:gate,recoverableCost:Number(recoverable.toFixed(2)),amountAtRisk:Number(Math.max(0,raw-recoverable).toFixed(2)),finalStatus:gate?'RECOVERABLE':'BLOCKED',approvedEntryCount:approved.length,rejectedEntryCount:rejected.length,pendingEntryCount:pending.length,approvalBasis:'APPROVED_WORK_ONLY'};
  }

  if(engine?.recoveryPassport&&!engine.recoveryPassport.__approvedWork90){
    const base=engine.recoveryPassport.bind(engine),wrapped=function(month,projectCode,options={}){const row=base(month,projectCode,options);return repairApprovedWorkRecovery90(row,month,projectCode,options.employeeId||row?.employeeId||'');};wrapped.__approvedWork90=true;engine.recoveryPassport=wrapped;
  }
  if(engine?.recoveryPassports&&!engine.recoveryPassports.__approvedWork90){
    const base=engine.recoveryPassports.bind(engine),wrapped=function(month,options={}){return (base(month,options)||[]).map(row=>repairApprovedWorkRecovery90(row,month,row?.projectCode,row?.employeeId));};wrapped.__approvedWork90=true;engine.recoveryPassports=wrapped;
  }

  window.AssuranceRegentRecoveryApproval={version:RECOVERY_APPROVED_WORK_SCHEMA90,decision:recoveryEntryDecision90,repair:repairApprovedWorkRecovery90};
  /* Assurance Regent v6.3.90 — approved-work recovery + rejected-entry exclusion END */