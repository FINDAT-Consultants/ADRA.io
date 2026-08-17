  /* Assurance Regent v6.3.73 — Work Activity progress + payroll cost bridge START */
  function workActivityMonth73(value=''){const v=String(value||'');return v.length>=7?`${v.slice(0,7)}-01`:state.month;}
  function workActivityProgress73(row={}){return Math.max(0,Math.min(100,Number(row.job_progress_total??row.completion_percent??0)||0));}
  function workActivityExpectedHours73(month){const key=String(month||'').slice(0,7);return (engine.state.calendar||[]).filter(x=>String(x.date||x.month||'').startsWith(key)&&String(x.dayType||'Working Day')==='Working Day').reduce((sum,x)=>sum+Math.max(0,Number(x.standardHours||0)),0);}
  function workActivityPayrollRow73(month,employeeId=''){const key=String(month||'').slice(0,7);return (engine.state.payroll||[]).find(x=>String(x.employeeId||'')===String(employeeId||'')&&String(x.month||'').startsWith(key))||null;}
  function workActivityRate73(row={}){
    const employeeId=String(row.employee_id||row.employeeId||''),projectCode=String(row.project_code||row.projectCode||''),month=workActivityMonth73(row.work_date||row.date||row.month),settings=state.control?.settings||{};
    const employeeRate=Number(settings.employeeHourlyRates?.[employeeId]||0),projectRate=Number(settings.projectHourlyRates?.[projectCode]||0),defaultRate=Number(settings.defaultHourlyRate||0);
    if(employeeRate>0)return {rate:employeeRate,source:'employee override',currency:activeCurrency(),status:'configured'};
    if(projectRate>0)return {rate:projectRate,source:'project override',currency:activeCurrency(),status:'configured'};
    if(defaultRate>0)return {rate:defaultRate,source:'default hourly rate',currency:activeCurrency(),status:'configured'};
    const payroll=workActivityPayrollRow73(month,employeeId),expected=workActivityExpectedHours73(month);
    if(payroll&&expected>0){const allocable=Number(payroll.allocableCost??0)||Number(payroll.basicSalary||0)+Number(payroll.benefits||0)+Number(payroll.statutoryCost||0)-Number(payroll.exclusions||0);if(allocable>0)return {rate:allocable/expected,source:'payroll ÷ expected hours',currency:activeCurrency(),status:'derived'};}
    return {rate:0,source:'rate required',currency:activeCurrency(),status:'rate_missing'};
  }
  function workActivityCost73(row={}){
    const snap=Number(row.hourly_rate_snapshot||0),hours=Math.max(0,Number(row.duration_hours||row.hours||0)),stored=row.operational_cost;
    if(snap>0&&stored!==undefined&&stored!==null&&Number.isFinite(Number(stored)))return {rate:snap,cost:Number(stored),currency:row.cost_currency||activeCurrency(),source:row.cost_rate_source||'saved rate',status:row.cost_status||'calculated'};
    const basis=workActivityRate73(row);return {...basis,cost:basis.rate>0?hours*basis.rate:null};
  }
  function workActivityProgressMarkup73(row={}){
    const total=workActivityProgress73(row),delta=Math.max(0,Number(row.session_progress_delta||0)),band=progressBand(total),job=workActivityJobId70?.(row)||'';
    return `<div class="work-progress73" role="progressbar" aria-label="${esc(job||'Work progress')} ${num(total,0)} percent" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${num(total,0)}"><div class="work-progress73-track"><span class="${band.className}" style="width:${total}%"></span></div><div class="work-progress73-meta"><b>${num(total,0)}%</b>${delta>0?`<small>+${num(delta,0)}% this session</small>`:'<small>cumulative</small>'}</div></div>`;
  }
  function workActivityCostMarkup73(row={}){const c=workActivityCost73(row);return c.rate>0?money(c.cost,c.currency,2):'<span class="work-rate-required73">Rate required</span>';}
  function workActivityRateMarkup73(row={}){const c=workActivityCost73(row);return c.rate>0?`${money(c.rate,c.currency,2)}<small class="work-rate-source73">${esc(c.source)}</small>`:'<span class="work-rate-required73">Rate required</span>';}
  function syncWorkActivityTimeEntryCost73(row={}){
    const entryId=row.recovery_entry_id||`MTS-DRAFT-${row.id}`,entry=(engine.state.timeEntries||[]).find(x=>String(x.entryId||'')===String(entryId));if(!entry)return false;const c=workActivityCost73(row);
    Object.assign(entry,{workActivitySessionId:row.id||'',jobId:workActivityJobId70?.(row)||'',hourlyRate:c.rate||0,operationalCost:c.cost,rateSource:c.source||'',costCurrency:c.currency||activeCurrency(),costStatus:c.rate>0?'calculated':'rate_missing'});return true;
  }
  async function snapshotWorkActivityCost73(row={}){
    if(!row?.id||!['completed','rework_required'].includes(row.status))return row;const existing=Number(row.hourly_rate_snapshot||0);if(existing>0&&row.operational_cost!==undefined&&row.operational_cost!==null){syncWorkActivityTimeEntryCost73(row);return row;}
    const basis=workActivityRate73(row),patch={hourly_rate_snapshot:basis.rate||0,operational_cost:basis.rate>0?Number(row.duration_hours||0)*basis.rate:null,cost_currency:basis.currency||activeCurrency(),cost_rate_source:basis.source,cost_status:basis.rate>0?'calculated':'rate_missing',cost_calculated_at:new Date().toISOString()},updated=persistWorkActivityJobPatch71(row.id,patch)||{...row,...patch};syncWorkActivityTimeEntryCost73(updated);return updated;
  }
  async function backfillWorkActivityCosts73(){let changed=false;for(const row of state.mtsSessions||[]){if(['completed','rework_required'].includes(row.status)){const before=JSON.stringify([row.hourly_rate_snapshot,row.operational_cost,row.cost_status]);await snapshotWorkActivityCost73(row);const updated=(state.mtsSessions||[]).find(x=>String(x.id)===String(row.id))||row,after=JSON.stringify([updated.hourly_rate_snapshot,updated.operational_cost,updated.cost_status]);if(before!==after)changed=true;if(syncWorkActivityTimeEntryCost73(updated))changed=true;}}if(changed){persistLocalLiveState();await flushWorkActivityState71();}return changed;}

  const baseCompleteMtsSession73=completeMtsSession;
  completeMtsSession=async function(){const id=$('mtsClockOutId')?.value||'';await baseCompleteMtsSession73();await loadMtsData();const row=(state.mtsSessions||[]).find(x=>String(x.id)===String(id));if(row&&row.status==='completed'){await snapshotWorkActivityCost73(row);persistLocalLiveState();await flushWorkActivityState71();await renderMts();refreshCurrent();}};

  const baseRenderMtsTable73=renderMtsTable;
  renderMtsTable=function(){
    baseRenderMtsTable73();if(state.mtsMode!=='individual'||!$('mtsTable'))return;
    const rows=filteredMtsSessions().sort((a,b)=>String(b.clock_in_at).localeCompare(String(a.clock_in_at))),trs=[...$('mtsTable').querySelectorAll('tbody tr:not(.empty-row)')];
    trs.forEach((tr,index)=>{const row=rows[index];if(!row)return;const cells=tr.children;if(cells[6])cells[6].innerHTML=workActivityProgressMarkup73(row);if(cells[10])cells[10].innerHTML=workActivityRateMarkup73(row);if(cells[11])cells[11].innerHTML=['completed','rework_required'].includes(row.status)?workActivityCostMarkup73(row):'—';});
  };

  function workActivityPayrollAggregate73(){
    const out=new Map();for(const row of state.mtsSessions||[]){if(row.status!=='completed'||!(Number(row.duration_hours)>0))continue;const month=workActivityMonth73(row.work_date),key=`${month}::${row.employee_id}`;if(!out.has(key))out.set(key,{month,employeeId:row.employee_id,hours:0,cost:0,costReady:true,rates:[],sessions:0});const x=out.get(key),c=workActivityCost73(row);x.hours+=Number(row.duration_hours||0);x.sessions++;if(c.rate>0&&c.cost!==null){x.cost+=Number(c.cost||0);x.rates.push(c.rate);}else x.costReady=false;}
    return out;
  }
  const baseRenderPayroll73=renderPayroll;
  renderPayroll=function(){
    const body=$('payrollBody');if(!body)return baseRenderPayroll73();const payrollRows=newestFirst(engine.payrollAnalysis(),['updatedAt','createdAt','month']),activity=workActivityPayrollAggregate73(),keys=new Set([...payrollRows.map(x=>`${workActivityMonth73(x.month)}::${x.employeeId}`),...activity.keys()]),rows=[...keys].map(key=>{const [month,employeeId]=key.split('::'),p=payrollRows.find(x=>workActivityMonth73(x.month)===month&&String(x.employeeId)===employeeId)||{month,employeeId,basicSalary:0,benefits:0,statutoryCost:0,exclusions:0,allocableCost:0,configurationStatus:'WORK ACTIVITY',source:'Work Activity Hub'},a=activity.get(key)||{hours:0,cost:0,costReady:true,rates:[],sessions:0};return {...p,_wa:a};}).sort((a,b)=>String(b.month).localeCompare(String(a.month)));
    const totalPayroll=rows.reduce((s,x)=>s+Number(x.allocableCost||0),0),totalActivity=rows.reduce((s,x)=>s+(x._wa.costReady?Number(x._wa.cost||0):0),0),trackedHours=rows.reduce((s,x)=>s+Number(x._wa.hours||0),0),missingRates=rows.filter(x=>x._wa.hours>0&&!x._wa.costReady).length;
    $('payrollKpis').innerHTML=[['Allocable payroll',money(totalPayroll),'Salary + benefits + statutory − exclusions',''],['Work activity cost',missingRates?'Rate required':money(totalActivity),'Clocked hours × hourly basis',missingRates?'warn':'good'],['Tracked hours',num(trackedHours,2),'Completed Work Activity sessions',''],['Rate gaps',missingRates,missingRates?'Set a rate in Settings or provide a payroll cost basis':'All tracked work costed',missingRates?'warn':'good']].map(x=>`<article class="kpi-card ${x[3]}"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></article>`).join('');
    const table=body.closest('table'),head=table?.querySelector('thead tr');if(head)head.innerHTML=['Month','Employee','Work hours','Hourly basis','Work activity cost','Basic salary','Benefits','Statutory','Exclusions','Allocable cost','Status','Source'].map(h=>`<th>${h}</th>`).join('');
    body.innerHTML=rows.length?rows.map(r=>{const a=r._wa,avg=a.rates.length?a.rates.reduce((s,v)=>s+v,0)/a.rates.length:0,activityCost=a.hours>0?(a.costReady?money(a.cost,activeCurrency(),2):'<span class="work-rate-required73">Rate required</span>'):'—',rate=a.hours>0?(a.costReady&&avg>0?money(avg,activeCurrency(),2):'<span class="work-rate-required73">Rate required</span>'):'—';return `<tr><td>${window.ADRAEngine.monthLabel(r.month)}</td><td>${userIdentity(r.employeeId,'',r.employeeId,'xs')}</td><td class="num"><b>${num(a.hours,2)}</b><small class="work-rate-source73">${a.sessions||0} session${a.sessions===1?'':'s'}</small></td><td class="num">${rate}</td><td class="num"><b>${activityCost}</b></td><td class="num">${money(r.basicSalary)}</td><td class="num">${money(r.benefits)}</td><td class="num">${money(r.statutoryCost)}</td><td class="num">${money(r.exclusions)}</td><td class="num"><b>${money(r.allocableCost)}</b></td><td>${resultChip(r.configurationStatus||'WORK ACTIVITY')}</td><td class="wrap">${esc(r.source||'Work Activity Hub')}</td></tr>`;}).join(''):'<tr class="empty-row"><td colspan="12"><div class="table-empty"><b>No payroll or Work Activity cost data yet</b><span>Clocked work will appear here once hours are completed.</span></div></td></tr>';paginateTable('payrollBody',true);
  };

  const baseRenderSettingsPane73=renderSettingsPane;
  renderSettingsPane=function(){baseRenderSettingsPane73();const hint=$('settingsDefaultHourlyRate')?.closest('label');if(hint&&!hint.querySelector('.work-rate-settings-hint73'))hint.insertAdjacentHTML('beforeend','<small class="work-rate-settings-hint73">Used by Work Activity costs when no employee/project override or payroll-derived hourly basis exists.</small>');};

  setTimeout(async()=>{try{await loadMtsData();await backfillWorkActivityCosts73();if(state.view==='work')renderMtsTable();if(state.view==='payroll')renderPayroll();}catch(err){reportClientIncident?.('work-activity-cost-backfill',err?.message||String(err),{},'MEDIUM');}},0);
  /* Assurance Regent v6.3.73 — Work Activity progress + payroll cost bridge END */
