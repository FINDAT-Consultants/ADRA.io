  /* Assurance Regent v6.3.85 — controlled Budget & Donor Excel imports + recovery budget feed START */
  const BUDGET_IMPORT_VIEW85='budget-import';
  const BUDGET_IMPORT_XLSX85='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  let budgetImportBundle85=null,budgetImportBusy85=false,budgetImportXlsxPromise85=null;

  function ensureBudgetImportStyles85(){
    if($('budgetImportStyles85'))return;
    const style=document.createElement('style');style.id='budgetImportStyles85';
    style.textContent=`
      .budget-import-hero85{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px;border:1px solid #dbe7ec;border-radius:20px;background:#fff;margin-bottom:16px}
      .budget-import-hero85 h2{margin:3px 0 7px}.budget-import-hero85 p{margin:0;max-width:760px;color:#66808e}
      .budget-import-actions85{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .budget-import-flow85{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
      .budget-import-flow85 article{border:1px solid #dce8ed;border-radius:15px;padding:13px;background:#f9fcfd;display:grid;gap:3px}.budget-import-flow85 small{color:#69818e}.budget-import-flow85 b{font-size:13px}
      .budget-import-active85{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.budget-import-active85 article{border:1px solid #dce8ed;border-radius:14px;padding:13px;background:#fff}.budget-import-active85 small{display:block;color:#6d8591}.budget-import-active85 b{display:block;margin-top:4px}
      .budget-import-table85 td,.budget-import-table85 th{vertical-align:top}.budget-import-status85{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eef5f7;font-size:11px;font-weight:800;letter-spacing:.02em}.budget-import-status85[data-status="ACTIVE"]{background:#e4f7ef;color:#087757}.budget-import-status85[data-status="PENDING_FINANCE_REVIEW"],.budget-import-status85[data-status="PENDING_COUNTRY_DIRECTOR"]{background:#fff4d8;color:#8b6100}.budget-import-status85[data-status="REJECTED"],.budget-import-status85[data-status="VALIDATION_FAILED"]{background:#fde9ec;color:#b3243d}
      .budget-import-batch-actions85{display:flex;gap:6px;flex-wrap:wrap}.budget-import-errors85{margin-top:5px;display:grid;gap:3px;color:#b3243d;font-size:11px}.budget-import-meta85{display:grid;gap:2px}.budget-import-meta85 small{color:#708692}
      .budget-import-progress85{margin-top:12px;padding:11px 13px;border:1px solid #dbe7ec;border-radius:13px;background:#f8fbfc;display:flex;align-items:center;gap:10px}.budget-import-progress85[hidden]{display:none!important}
      @media(max-width:900px){.budget-import-hero85{flex-direction:column}.budget-import-actions85{justify-content:flex-start}.budget-import-flow85,.budget-import-active85{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.budget-import-flow85,.budget-import-active85{grid-template-columns:1fr}.budget-import-actions85 .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function budgetImportClientEligible85(){
    const u=controlUser?.()||{},a=functionalAuthority?.(effectiveUserOrg?.(u)||u)||'';
    const text=`${u.position||''} ${u.department||''} ${u.supervisoryRole||''}`.toLowerCase();
    return ['DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER','AUDITOR'].includes(a)||/(finance|accountant|accounting|grants accountant|project accountant|country director|country representative)/i.test(text);
  }

  function ensureBudgetImportView85(){
    ensureBudgetImportStyles85();
    let nav=document.querySelector(`.nav-item[data-view="${BUDGET_IMPORT_VIEW85}"]`),view=$(`view-${BUDGET_IMPORT_VIEW85}`);
    const anchor=document.querySelector('.nav-item[data-view="assurance"]');
    if(!nav&&anchor){nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.dataset.view=BUDGET_IMPORT_VIEW85;nav.innerHTML='<span>⇧</span> Budget &amp; Donor Import';anchor.insertAdjacentElement('afterend',nav);}
    if(nav){nav.hidden=!budgetImportClientEligible85();if(!nav.dataset.bound85){nav.dataset.bound85='1';nav.addEventListener('click',()=>openBudgetImportView85());}}
    if(!view){
      view=document.createElement('div');view.className='view';view.id=`view-${BUDGET_IMPORT_VIEW85}`;
      view.innerHTML=`
        <section class="budget-import-hero85">
          <div><span class="section-kicker">Controlled financial configuration</span><h2>Budget &amp; Donor Batch Import</h2><p>Upload the approved Excel template in bulk. Data is staged first, reviewed by Finance, and only becomes available to Recovery Voucher after independent Country Director/CEO activation.</p></div>
          <div class="budget-import-actions85"><button type="button" class="btn ghost" data-budget-template85>Download Excel template</button><button type="button" class="btn primary" data-budget-upload85>Upload Excel</button><button type="button" class="btn ghost" data-budget-refresh85>Refresh</button><input type="file" data-budget-file85 accept=".xlsx,.xls" hidden /></div>
        </section>
        <div class="budget-import-flow85"><article><small>1 · Maker</small><b>Finance uploads</b><span>Excel is parsed and staged in controlled tables.</span></article><article><small>2 · Validation</small><b>System checks the batch</b><span>Employees, values, dates, currency and rule types are validated.</span></article><article><small>3 · Checker</small><b>Finance Manager reviews</b><span>The uploader cannot approve their own batch.</span></article><article><small>4 · Approver</small><b>Country Director activates</b><span>The active version then feeds Recovery Assurance.</span></article></div>
        <div class="budget-import-progress85" id="budgetImportProgress85" hidden><b>Processing…</b><span id="budgetImportProgressText85">Preparing the batch.</span></div>
        <section class="panel"><div class="panel-head"><div><span class="section-kicker">Active financial version</span><h3>Recovery budget source</h3></div></div><div id="budgetImportActive85" class="budget-import-active85"></div></section>
        <section class="panel" style="margin-top:16px"><div class="panel-head"><div><span class="section-kicker">Staging &amp; approvals</span><h3>Budget import batches</h3></div></div><div class="table-wrap"><table class="budget-import-table85"><thead><tr><th>Version</th><th>File / uploader</th><th>Summary</th><th>Status</th><th>Review trail</th><th>Actions</th></tr></thead><tbody id="budgetImportBatches85"></tbody></table></div></section>`;
      const assurance=$('view-assurance');if(assurance)assurance.insertAdjacentElement('afterend',view);else document.querySelector('.content')?.appendChild(view);
    }
    if(view&&!view.dataset.bound85){
      view.dataset.bound85='1';
      view.querySelector('[data-budget-template85]')?.addEventListener('click',downloadBudgetTemplate85);
      view.querySelector('[data-budget-upload85]')?.addEventListener('click',()=>view.querySelector('[data-budget-file85]')?.click());
      view.querySelector('[data-budget-file85]')?.addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await uploadBudgetWorkbook85(file);});
      view.querySelector('[data-budget-refresh85]')?.addEventListener('click',()=>loadBudgetImport85(true));
      view.addEventListener('click',async e=>{const btn=e.target.closest('[data-budget-action85]');if(!btn)return;await decideBudgetBatch85(btn.dataset.budgetId85,btn.dataset.budgetAction85);});
    }
    return view;
  }

  async function openBudgetImportView85(){
    const view=ensureBudgetImportView85();if(!view||!budgetImportClientEligible85())return;
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active-view'));view.classList.add('active-view');
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===BUDGET_IMPORT_VIEW85));
    if($('pageEyebrow'))$('pageEyebrow').textContent='Financial controls';if($('pageTitle'))$('pageTitle').textContent='Budget & Donor Import';if($('pageSubtitle'))$('pageSubtitle').textContent='Batch budgets, personnel rates and donor rules with staged approval before recovery use.';
    await loadBudgetImport85(true);
  }

  function budgetImportProgress85(text='',show=true){const box=$('budgetImportProgress85'),label=$('budgetImportProgressText85');if(label)label.textContent=text;if(box)box.hidden=!show;}
  function budgetImportCompany85(){return currentCompanyId?.()||controlUser?.()?.companyId||'';}
  function budgetImportUserId85(){return String(controlUser?.()?.id||'');}

  async function loadBudgetImport85(force=false){
    ensureBudgetImportView85();if(!browserSessionToken||!budgetImportClientEligible85())return null;
    if(!force&&budgetImportBundle85)return budgetImportBundle85;
    try{budgetImportBundle85=await supabaseRpc('assurance_regent_browser_budget_import_bundle',{p_token:browserSessionToken,p_company_id:budgetImportCompany85()||''},{bypassCache:true});renderBudgetImport85();return budgetImportBundle85;}
    catch(err){budgetImportBundle85=null;renderBudgetImport85(err);return null;}
  }

  function budgetStatusLabel85(status=''){return String(status||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
  function renderBudgetImport85(error=null){
    const activeHost=$('budgetImportActive85'),body=$('budgetImportBatches85'),b=budgetImportBundle85||{},active=b.activeBatch||null;
    if(activeHost){if(error)activeHost.innerHTML=`<article><small>Unavailable</small><b>${esc(error?.message||String(error))}</b></article>`;else if(active){const s=active.summary||{};activeHost.innerHTML=`<article><small>Version</small><b>${esc(active.version_label||`Version ${active.version_no}`)}</b></article><article><small>Personnel budget</small><b>${money(Number(s.totalPersonnelBudget||0),active.currency||activeCurrency(),2)}</b></article><article><small>Projects / rates</small><b>${num(s.projectCount||0)} / ${num(s.employeeRateCount||0)}</b></article><article><small>Activated</small><b>${esc(active.country_approved_by_name||'Approved')} · ${esc(String(active.activated_at||'').slice(0,10))}</b></article>`;}else activeHost.innerHTML='<article><small>Status</small><b>No approved active budget version</b><span>Recovery Voucher will continue to use legacy project/payroll configuration until a batch is activated.</span></article>';}
    if(!body)return;const rows=Array.isArray(b.batches)?b.batches:[],uid=budgetImportUserId85();
    body.innerHTML=rows.length?rows.map(row=>{const s=row.summary||{},errors=Array.isArray(row.validation_errors)?row.validation_errors:[],financeReady=b.canFinanceReview&&row.status==='PENDING_FINANCE_REVIEW'&&String(row.uploaded_by)!==uid,countryReady=b.canCountryApprove&&row.status==='PENDING_COUNTRY_DIRECTOR'&&String(row.uploaded_by)!==uid&&String(row.finance_reviewed_by||'')!==uid;return `<tr><td><b>${esc(row.version_label||`Version ${row.version_no}`)}</b><small>${esc(row.currency||'')}</small></td><td><div class="budget-import-meta85"><b>${esc(row.file_name||'Excel budget')}</b><small>Uploaded by ${esc(row.uploaded_by_name||row.uploaded_by||'')}</small><small>${esc(String(row.uploaded_at||'').slice(0,16).replace('T',' '))}</small></div></td><td><div class="budget-import-meta85"><b>${num(s.projectCount||0)} projects · ${num(s.employeeRateCount||0)} rates</b><small>${num(s.donorRuleCount||0)} donor rules · ${money(Number(s.totalPersonnelBudget||0),row.currency||activeCurrency(),2)}</small>${Number(s.unknownProjectCount||0)?`<small>${num(s.unknownProjectCount)} imported project(s) are not yet in the live project master.</small>`:''}${errors.length?`<div class="budget-import-errors85">${errors.map(x=>`<span>${esc(x.message||x.type||'Validation error')}</span>`).join('')}</div>`:''}</div></td><td><span class="budget-import-status85" data-status="${esc(row.status||'')}">${esc(budgetStatusLabel85(row.status))}</span></td><td><div class="budget-import-meta85"><small>Finance: ${esc(row.finance_reviewed_by_name||'Pending')}</small><small>Country Director: ${esc(row.country_approved_by_name||'Pending')}</small>${row.decision_note?`<small>${esc(row.decision_note)}</small>`:''}</div></td><td><div class="budget-import-batch-actions85">${financeReady?`<button class="btn micro primary" type="button" data-budget-action85="FINANCE_APPROVE" data-budget-id85="${esc(row.id)}">Finance approve</button><button class="btn micro ghost" type="button" data-budget-action85="RETURN" data-budget-id85="${esc(row.id)}">Return</button>`:''}${countryReady?`<button class="btn micro primary" type="button" data-budget-action85="COUNTRY_APPROVE" data-budget-id85="${esc(row.id)}">Approve &amp; activate</button><button class="btn micro ghost" type="button" data-budget-action85="REJECT" data-budget-id85="${esc(row.id)}">Reject</button>`:''}${!financeReady&&!countryReady?'<span>—</span>':''}</div></td></tr>`;}).join(''):'<tr class="empty-row"><td colspan="6"><div class="table-empty"><b>No budget batches yet</b><span>Download the Excel template, complete it, then upload it here.</span></div></td></tr>';
  }

  async function ensureBudgetXlsx85(){
    if(window.XLSX)return window.XLSX;if(budgetImportXlsxPromise85)return budgetImportXlsxPromise85;
    budgetImportXlsxPromise85=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=BUDGET_IMPORT_XLSX85;script.async=true;script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel parser did not initialize.'));script.onerror=()=>reject(new Error('Could not load the Excel parser. Check the internet connection and try again.'));document.head.appendChild(script);});
    try{return await budgetImportXlsxPromise85;}catch(err){budgetImportXlsxPromise85=null;throw err;}
  }

  async function downloadBudgetTemplate85(){
    try{const XLSX=await ensureBudgetXlsx85(),wb=XLSX.utils.book_new(),currency=activeCurrency()||'USD',today=new Date().toISOString().slice(0,10);
      const sheets={
        'Metadata':[['Key','Value'],['Version Label',`Budget ${new Date().getUTCFullYear()}`],['Currency',currency],['Effective From',today],['Effective To','']],
        'Project Budget':[['Project Code','Project Name','Donor','Currency','Personnel Budget','Effective From','Effective To'],['FIN-010','Example Project','Example Donor',currency,100000,today,'']],
        'Personnel Rates':[['Employee ID','Project Code','Hourly Rate','Currency','Effective From','Effective To'],['E001','FIN-010',100,currency,today,'']],
        'Donor Rules':[['Donor','Project Code','Rule Key','Numeric Value','Text Value','Effective From','Effective To'],['Example Donor','FIN-010','MAX_HOURLY_COST',150,'',today,''],['Example Donor','FIN-010','CURRENCY','',currency,today,''],['Example Donor','FIN-010','ALLOW_ADMIN','','no',today,'']]
      };
      for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
      XLSX.writeFile(wb,'Assurance_Regent_Budget_Donor_Import_Template.xlsx');
    }catch(err){toast(err?.message||String(err));}
  }

  function budgetHeaderKey85(value){return String(value??'').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();}
  function budgetCell85(row,aliases){for(const [k,v] of Object.entries(row||{}))if(aliases.includes(budgetHeaderKey85(k)))return v;return '';}
  function budgetDate85(value,XLSX){if(value===null||value===undefined||value==='')return '';if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10);if(typeof value==='number'&&XLSX?.SSF?.parse_date_code){const d=XLSX.SSF.parse_date_code(value);if(d)return `${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}const s=String(value).trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const d=new Date(s);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);}
  function budgetNumber85(value){if(typeof value==='number')return value;const n=Number(String(value??'').replace(/[, ]/g,''));return Number.isFinite(n)?n:null;}
  function budgetSheetRows85(wb,names,XLSX){const name=names.find(n=>wb.SheetNames.some(s=>budgetHeaderKey85(s)===budgetHeaderKey85(n))),actual=wb.SheetNames.find(s=>name&&budgetHeaderKey85(s)===budgetHeaderKey85(name));return actual?XLSX.utils.sheet_to_json(wb.Sheets[actual],{defval:'',raw:true}):[];}
  function parseBudgetWorkbook85(wb,XLSX){
    const metaRows=budgetSheetRows85(wb,['Metadata'],XLSX),meta={};for(const row of metaRows){const k=budgetHeaderKey85(budgetCell85(row,['key','field','setting'])),v=budgetCell85(row,['value']);if(k)meta[k]=v;}
    const projectRaw=budgetSheetRows85(wb,['Project Budget','Projects','Budget'],XLSX),rateRaw=budgetSheetRows85(wb,['Personnel Rates','Rates','Employee Rates'],XLSX),ruleRaw=budgetSheetRows85(wb,['Donor Rules','Rules'],XLSX),defaultCurrency=String(meta['currency']||activeCurrency()||'USD').trim().toUpperCase();
    const projects=projectRaw.map((r,i)=>({project_code:String(budgetCell85(r,['project code','project id','code'])||'').trim().toUpperCase(),project_name:String(budgetCell85(r,['project name','project'])||'').trim(),donor:String(budgetCell85(r,['donor','funder'])||'').trim(),currency:String(budgetCell85(r,['currency','currency code'])||defaultCurrency).trim().toUpperCase(),personnel_budget:budgetNumber85(budgetCell85(r,['personnel budget','staff budget','personnel cost budget'])),effective_from:budgetDate85(budgetCell85(r,['effective from','start date','from']),XLSX)||budgetDate85(meta['effective from'],XLSX),effective_to:budgetDate85(budgetCell85(r,['effective to','end date','to']),XLSX)||budgetDate85(meta['effective to'],XLSX),source_row:i+2})).filter(x=>x.project_code||x.personnel_budget!==null);
    const rates=rateRaw.map((r,i)=>({employee_id:String(budgetCell85(r,['employee id','employee code','staff id'])||'').trim(),project_code:String(budgetCell85(r,['project code','project id','code'])||'').trim().toUpperCase(),hourly_rate:budgetNumber85(budgetCell85(r,['hourly rate','rate','personnel rate'])),currency:String(budgetCell85(r,['currency','currency code'])||defaultCurrency).trim().toUpperCase(),effective_from:budgetDate85(budgetCell85(r,['effective from','start date','from']),XLSX)||budgetDate85(meta['effective from'],XLSX),effective_to:budgetDate85(budgetCell85(r,['effective to','end date','to']),XLSX)||budgetDate85(meta['effective to'],XLSX),source_row:i+2})).filter(x=>x.employee_id||x.hourly_rate!==null);
    const rules=ruleRaw.map((r,i)=>({donor:String(budgetCell85(r,['donor','funder'])||'').trim(),project_code:String(budgetCell85(r,['project code','project id','code'])||'').trim().toUpperCase(),rule_key:String(budgetCell85(r,['rule key','rule','rule type'])||'').trim().toUpperCase().replace(/\s+/g,'_'),numeric_value:budgetNumber85(budgetCell85(r,['numeric value','number','limit','numeric'])),text_value:String(budgetCell85(r,['text value','text','setting'])||'').trim(),effective_from:budgetDate85(budgetCell85(r,['effective from','start date','from']),XLSX)||budgetDate85(meta['effective from'],XLSX),effective_to:budgetDate85(budgetCell85(r,['effective to','end date','to']),XLSX)||budgetDate85(meta['effective to'],XLSX),source_row:i+2})).filter(x=>x.rule_key);
    if(!projects.length)throw new Error('The workbook needs at least one row in the “Project Budget” sheet.');
    const allowedRules=new Set(['EVIDENCE_REQUIRED','MAX_HOURLY_COST','MAX_PERSONNEL_CHARGE','CURRENCY','ALLOW_ADMIN','CUSTOM']);
    const errors=[];for(const p of projects){if(!p.project_code)errors.push(`Project Budget row ${p.source_row}: Project Code is required.`);if(p.personnel_budget===null||p.personnel_budget<0)errors.push(`Project Budget row ${p.source_row}: Personnel Budget must be zero or greater.`);if(!/^[A-Z]{3}$/.test(p.currency))errors.push(`Project Budget row ${p.source_row}: Currency must be a 3-letter code.`);}for(const r of rates){if(!r.employee_id)errors.push(`Personnel Rates row ${r.source_row}: Employee ID is required.`);if(r.hourly_rate===null||r.hourly_rate<=0)errors.push(`Personnel Rates row ${r.source_row}: Hourly Rate must be greater than zero.`);if(!/^[A-Z]{3}$/.test(r.currency))errors.push(`Personnel Rates row ${r.source_row}: Currency must be a 3-letter code.`);}for(const r of rules)if(!allowedRules.has(r.rule_key))errors.push(`Donor Rules row ${r.source_row}: unsupported Rule Key “${r.rule_key}”.`);if(errors.length)throw new Error(errors.slice(0,8).join('\n')+(errors.length>8?`\n…and ${errors.length-8} more error(s).`:''));
    return {meta:{version_label:String(meta['version label']||meta['version']||'').trim(),currency:defaultCurrency,effective_from:budgetDate85(meta['effective from'],XLSX),effective_to:budgetDate85(meta['effective to'],XLSX)},projects,rates,rules};
  }

  async function budgetAppendChunks85(batchId,type,rows){for(let i=0;i<rows.length;i+=200){budgetImportProgress85(`Uploading ${type.toLowerCase()} rows ${i+1}–${Math.min(i+200,rows.length)} of ${rows.length}…`);await supabaseRpc('assurance_regent_browser_budget_import_append',{p_token:browserSessionToken,p_batch_id:batchId,p_row_type:type,p_rows:rows.slice(i,i+200)},{bypassCache:true});}}

  async function uploadBudgetWorkbook85(file){
    if(budgetImportBusy85)return;if(!/\.(xlsx|xls)$/i.test(file.name||''))return toast('Choose an Excel .xlsx or .xls budget file.');budgetImportBusy85=true;
    try{budgetImportProgress85('Reading and validating the Excel workbook…');const XLSX=await ensureBudgetXlsx85(),data=await file.arrayBuffer(),wb=XLSX.read(data,{type:'array',cellDates:true}),parsed=parseBudgetWorkbook85(wb,XLSX);
      budgetImportProgress85('Storing the original workbook securely for audit traceability…');const stored=await uploadPersistentFile(file,{category:'budget-import',entityType:'BUDGET_IMPORT',metadata:{versionLabel:parsed.meta.version_label||'',projectCount:parsed.projects.length,rateCount:parsed.rates.length,ruleCount:parsed.rules.length}});
      budgetImportProgress85('Creating the staged budget version…');const batch=await supabaseRpc('assurance_regent_browser_budget_import_begin',{p_token:browserSessionToken,p_company_id:budgetImportCompany85()||'',p_file_id:stored?.fileId||stored?.storageFileId||'',p_file_name:file.name,p_version_label:parsed.meta.version_label||'',p_currency:parsed.meta.currency||activeCurrency()||'USD',p_effective_from:parsed.meta.effective_from||null,p_effective_to:parsed.meta.effective_to||null,p_metadata:{sheetNames:wb.SheetNames,projectRows:parsed.projects.length,rateRows:parsed.rates.length,ruleRows:parsed.rules.length}},{bypassCache:true});
      await budgetAppendChunks85(batch.id,'PROJECT',parsed.projects);if(parsed.rates.length)await budgetAppendChunks85(batch.id,'RATE',parsed.rates);if(parsed.rules.length)await budgetAppendChunks85(batch.id,'RULE',parsed.rules);
      budgetImportProgress85('Running server-side validation and placing the batch into Finance review…');const result=await supabaseRpc('assurance_regent_browser_budget_import_finalize',{p_token:browserSessionToken,p_batch_id:batch.id},{bypassCache:true});
      budgetImportBundle85=null;await loadBudgetImport85(true);toast(result.status==='PENDING_FINANCE_REVIEW'?'Budget batch validated and sent to Finance review.':'Budget batch uploaded, but validation issues must be corrected in a new revision.');
    }catch(err){console.error('Budget import failed',err);toast(err?.message||String(err));}finally{budgetImportBusy85=false;budgetImportProgress85('',false);}
  }

  async function decideBudgetBatch85(id,action){
    if(!id||!action||budgetImportBusy85)return;let note='';if(['RETURN','REJECT'].includes(action)){note=prompt(action==='RETURN'?'Why is this batch being returned for correction?':'Why is this batch being rejected?','')||'';if(!note.trim())return toast('A review note is required.');}else if(action==='COUNTRY_APPROVE'){if(!confirm('Approve and activate this budget version? It will supersede the current active budget and become the Recovery Voucher source.'))return;note='Approved for activation.';}else if(action==='FINANCE_APPROVE'){if(!confirm('Confirm that Finance has reviewed the budget totals, personnel rates and donor rules in this batch?'))return;note='Finance review completed.';}
    budgetImportBusy85=true;try{budgetImportProgress85('Recording the approval decision…');await supabaseRpc('assurance_regent_browser_budget_import_decide',{p_token:browserSessionToken,p_batch_id:id,p_action:action,p_note:note},{bypassCache:true});budgetImportBundle85=null;state.recoveryLoadedAt=0;if(canUseRecoveryAssurance())await loadRecoveryAssurance(true);await loadBudgetImport85(true);refreshCurrent?.();toast(action==='COUNTRY_APPROVE'?'Budget version activated for Recovery Assurance.':'Budget review decision saved.');}catch(err){toast(err?.message||String(err));}finally{budgetImportBusy85=false;budgetImportProgress85('',false);}
  }

  function importedRecoveryRuleNumber85(row,key){return (row?.appliedRules||[]).filter(r=>String(r?.rule_key??r?.ruleKey??'')===key).map(r=>Number(r?.numeric_value??r?.numericValue)).filter(Number.isFinite);}
  function repairImportedRecovery85(row,month,bundle){
    if(!row)return row;const rb=bundle&&typeof bundle==='object'?bundle:{},code=String(row.projectCode||'').trim().toUpperCase(),employeeId=String(row.employeeId||'').trim(),budgets=Array.isArray(rb.activeBudgets)?rb.activeBudgets:[],rates=Array.isArray(rb.activeRates)?rb.activeRates:[];
    const budget=budgets.find(x=>String(x?.project_code??x?.projectCode??'').trim().toUpperCase()===code),exactRate=rates.find(x=>String(x?.employee_id??x?.employeeId??'').trim()===employeeId&&String(x?.project_code??x?.projectCode??'').trim().toUpperCase()===code),generalRate=rates.find(x=>String(x?.employee_id??x?.employeeId??'').trim()===employeeId&&!String(x?.project_code??x?.projectCode??'').trim()),rate=exactRate||generalRate;
    const importedBudget=Number(budget?.personnel_budget??budget?.personnelBudget),importedRate=Number(rate?.hourly_rate??rate?.hourlyRate),budgetLimit=Number.isFinite(importedBudget)&&importedBudget>=0?importedBudget:Number(row.budgetLimit||0),hourlyCost=Number.isFinite(importedRate)&&importedRate>0?importedRate:Number(row.hourlyCost||0),rawCost=Number(row.approvedProjectHours||0)*hourlyCost,expected=Number(row.expectedHours||0),recorded=Number(row.recordedEmployeeHours||0),eps=.01;
    const keys={...(row.keys||{})};keys.capacity=expected>eps&&recorded<=expected+eps?'PASS':'FAIL';keys.budget=budgetLimit>0&&rawCost<=budgetLimit?'PASS':'FAIL';
    const maxHourly=importedRecoveryRuleNumber85(row,'MAX_HOURLY_COST'),maxCharge=importedRecoveryRuleNumber85(row,'MAX_PERSONNEL_CHARGE'),currencyRules=(row.appliedRules||[]).filter(r=>String(r?.rule_key??r?.ruleKey??'')==='CURRENCY').map(r=>String(r?.text_value??r?.textValue??'').trim().toUpperCase()).filter(Boolean),currency=String(activeCurrency?.()||'').toUpperCase(),budgetCurrency=String(budget?.currency||'').toUpperCase(),rateCurrency=String(rate?.currency||'').toUpperCase();
    if(maxHourly.length&&hourlyCost>Math.min(...maxHourly))keys.budget='FAIL';if(maxCharge.length&&rawCost>Math.min(...maxCharge))keys.budget='FAIL';if(currencyRules.length&&currency&&!currencyRules.includes(currency))keys.budget='FAIL';if(budgetCurrency&&currency&&budgetCurrency!==currency)keys.budget='FAIL';if(rateCurrency&&currency&&rateCurrency!==currency)keys.budget='FAIL';
    const limits=[budgetLimit,...maxCharge].filter(x=>Number.isFinite(x)&&x>0),limit=limits.length?Math.min(...limits):budgetLimit,gate=Object.values(keys).every(x=>x==='PASS')?1:0,recoverableCost=gate?Math.min(rawCost,limit||rawCost):0,keyReasons={...(row.keyReasons||{})};
    keyReasons.capacity=keys.capacity==='PASS'?`${Number(recorded.toFixed(5))} approved hours are within ${Number(expected.toFixed(5))} available monthly capacity.`:`${Number(recorded.toFixed(5))} approved hours exceed ${Number(expected.toFixed(5))} available monthly capacity by ${Number(Math.max(0,recorded-expected).toFixed(5))} hours.`;
    if(!budgetLimit)keyReasons.budget='No active approved personnel budget is available for this project. Upload, review and activate a Budget & Donor batch.';else if(keys.budget==='PASS')keyReasons.budget=`Proposed personnel charge ${Number(rawCost.toFixed(2))} is within the active personnel budget of ${Number(budgetLimit.toFixed(2))}.`;else keyReasons.budget=`Proposed personnel charge ${Number(rawCost.toFixed(2))} exceeds an active project/donor ceiling, rate rule or currency rule.`;
    return {...row,hourlyCost:Number(hourlyCost.toFixed(8)),rawCost:Number(rawCost.toFixed(2)),budgetLimit:Number(budgetLimit.toFixed(2)),keys,keyReasons,recoveryGate:gate,recoverableCost:Number(recoverableCost.toFixed(2)),amountAtRisk:Number(Math.max(0,rawCost-recoverableCost).toFixed(2)),finalStatus:gate?'RECOVERABLE':'BLOCKED',budgetSource:budget?'APPROVED_IMPORT':row.budgetSource||'LEGACY_PROJECT',rateSource:rate?'APPROVED_IMPORT':row.rateSource||'PAYROLL',activeBudgetVersion:rb.activeBudgetBatch?.version_no||null};
  }

  if(engine?.recoveryPassport&&!engine.recoveryPassport.__budgetImport85){const base=engine.recoveryPassport.bind(engine),wrapped=function(month,projectCode,options={}){return repairImportedRecovery85(base(month,projectCode,options),month,recoveryBundle());};wrapped.__budgetImport85=true;engine.recoveryPassport=wrapped;}
  if(engine?.recoveryPassports&&!engine.recoveryPassports.__budgetImport85){const base=engine.recoveryPassports.bind(engine),wrapped=function(month,options={}){const rb=recoveryBundle(),rows=(base(month,options)||[]).map(r=>repairImportedRecovery85(r,month,rb)),groups=new Map();for(const r of rows){if(!groups.has(r.projectCode))groups.set(r.projectCode,[]);groups.get(r.projectCode).push(r);}for(const group of groups.values()){const total=group.reduce((n,r)=>n+Number(r.rawCost||0),0),limit=Number(group[0]?.budgetLimit||0);if(limit>0&&total>limit)for(const r of group){r.keys.budget='FAIL';r.keyReasons.budget=`Combined proposed personnel charges for ${r.projectCode} are ${Number(total.toFixed(2))} against the active personnel budget of ${Number(limit.toFixed(2))}.`;r.recoveryGate=0;r.finalStatus='BLOCKED';r.recoverableCost=0;r.amountAtRisk=r.rawCost;}}return rows;};wrapped.__budgetImport85=true;engine.recoveryPassports=wrapped;}

  const loadRecoveryAssuranceBase85=loadRecoveryAssurance;
  loadRecoveryAssurance=async function(force=false){const result=await loadRecoveryAssuranceBase85(force);if($(`view-${BUDGET_IMPORT_VIEW85}`)?.classList.contains('active-view'))renderBudgetImport85();return result;};

  ensureBudgetImportView85();
  document.addEventListener('assurance-regent-auth-change',()=>{budgetImportBundle85=null;ensureBudgetImportView85();});
  /* Assurance Regent v6.3.85 — controlled Budget & Donor Excel imports + recovery budget feed END */
