  /* Assurance Regent v6.3.86 — Budget & Donor Import UI + control reliability START */
  const BUDGET_IMPORT_PAGE_SIZE86=5;
  const BUDGET_IMPORT_XLSX_SELF86='./vendor/xlsx.full.min.js';
  let budgetImportPage86=1,budgetImportLastRefresh86='';

  const ensureBudgetImportViewBase86=ensureBudgetImportView85;
  const renderBudgetImportBase86=renderBudgetImport85;
  const loadBudgetImportBase86=loadBudgetImport85;
  const openBudgetImportViewBase86=openBudgetImportView85;

  // v6.3.85 used an inline STYLE element, but production CSP is style-src 'self'.
  // v6.3.86 serves a static stylesheet instead and keeps the strict CSP unchanged.
  ensureBudgetImportStyles85=function(){return;};

  // Use the vendored same-origin SheetJS asset so Download/Upload are not blocked by script-src 'self'.
  ensureBudgetXlsx85=async function(){
    if(window.XLSX)return window.XLSX;
    if(budgetImportXlsxPromise85)return budgetImportXlsxPromise85;
    budgetImportXlsxPromise85=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-budget-xlsx86]');
      if(existing){existing.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel parser did not initialize.')),{once:true});existing.addEventListener('error',()=>reject(new Error('Could not load the local Excel parser.')),{once:true});return;}
      const script=document.createElement('script');script.src=BUDGET_IMPORT_XLSX_SELF86;script.async=true;script.dataset.budgetXlsx86='1';
      script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel parser did not initialize.'));
      script.onerror=()=>reject(new Error('Could not load the local Excel parser. Refresh the page and try again.'));
      document.head.appendChild(script);
    });
    try{return await budgetImportXlsxPromise85;}catch(err){budgetImportXlsxPromise85=null;throw err;}
  };

  function ensureBudgetImportPolish86(view){
    if(!view)return view;
    const hero=view.querySelector('.budget-import-hero85'),actions=view.querySelector('.budget-import-actions85');
    if(hero)hero.setAttribute('aria-label','Budget and donor import controls');
    if(actions&&!view.querySelector('#budgetImportRefreshStatus86')){
      const status=document.createElement('div');status.id='budgetImportRefreshStatus86';status.className='budget-import-refresh-status86';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='Ready';actions.appendChild(status);
    }
    const body=view.querySelector('#budgetImportBatches85'),panel=body?.closest('.panel');
    if(panel&&!panel.querySelector('#budgetImportTableFooter86')){
      const footer=document.createElement('div');footer.id='budgetImportTableFooter86';footer.className='budget-import-table-footer86';footer.innerHTML='<span id="budgetImportRange86" class="budget-import-range86">0 batches</span><nav id="budgetImportPager86" class="budget-import-pager86" aria-label="Budget import pages"></nav>';panel.appendChild(footer);
    }
    const table=view.querySelector('.budget-import-table85');if(table&&!table.getAttribute('aria-label'))table.setAttribute('aria-label','Budget import batches');
    return view;
  }

  ensureBudgetImportView85=function(){const view=ensureBudgetImportViewBase86();return ensureBudgetImportPolish86(view);};

  function budgetImportPageItems86(pageCount,current){
    if(pageCount<=7)return Array.from({length:pageCount},(_,i)=>i+1);
    const keep=new Set([1,pageCount,current,current-1,current+1]);
    const pages=[...keep].filter(x=>x>=1&&x<=pageCount).sort((a,b)=>a-b),out=[];let prev=0;
    for(const p of pages){if(prev&&p-prev>1)out.push('gap');out.push(p);prev=p;}return out;
  }

  function renderBudgetImportPager86(total){
    const pager=$('budgetImportPager86'),range=$('budgetImportRange86');if(!pager||!range)return;
    const count=Math.max(0,Number(total||0)),pageCount=Math.max(1,Math.ceil(count/BUDGET_IMPORT_PAGE_SIZE86));budgetImportPage86=Math.max(1,Math.min(pageCount,budgetImportPage86));
    const start=count?(budgetImportPage86-1)*BUDGET_IMPORT_PAGE_SIZE86+1:0,end=count?Math.min(count,budgetImportPage86*BUDGET_IMPORT_PAGE_SIZE86):0;
    range.textContent=count?`Showing ${start}–${end} of ${count} batches`:'0 batches';
    if(pageCount<=1){pager.innerHTML='';pager.hidden=true;return;}pager.hidden=false;
    const items=budgetImportPageItems86(pageCount,budgetImportPage86),buttons=[];
    buttons.push(`<button type="button" class="budget-import-page86" data-budget-page86="${budgetImportPage86-1}" ${budgetImportPage86===1?'disabled':''} aria-label="Previous page">Previous</button>`);
    for(const item of items){if(item==='gap')buttons.push('<span class="budget-import-page-gap86" aria-hidden="true">…</span>');else buttons.push(`<button type="button" class="budget-import-page86" data-budget-page86="${item}" ${item===budgetImportPage86?'aria-current="page"':''} aria-label="Page ${item}">${item}</button>`);}
    buttons.push(`<button type="button" class="budget-import-page86" data-budget-page86="${budgetImportPage86+1}" ${budgetImportPage86===pageCount?'disabled':''} aria-label="Next page">Next</button>`);pager.innerHTML=buttons.join('');
  }

  renderBudgetImport85=function(error=null){
    ensureBudgetImportPolish86($(`view-${BUDGET_IMPORT_VIEW85}`));
    const full=budgetImportBundle85,rows=Array.isArray(full?.batches)?full.batches:[],pageCount=Math.max(1,Math.ceil(rows.length/BUDGET_IMPORT_PAGE_SIZE86));budgetImportPage86=Math.max(1,Math.min(pageCount,budgetImportPage86));
    if(full){const start=(budgetImportPage86-1)*BUDGET_IMPORT_PAGE_SIZE86;budgetImportBundle85={...full,batches:rows.slice(start,start+BUDGET_IMPORT_PAGE_SIZE86)};}
    try{renderBudgetImportBase86(error);}finally{if(full)budgetImportBundle85=full;}
    renderBudgetImportPager86(rows.length);
  };

  function budgetImportRefreshStatus86(text){const el=$('budgetImportRefreshStatus86');if(el)el.textContent=text||'';}
  function budgetImportButtonBusy86(button,busy,label){if(!button)return;if(busy){if(!button.dataset.budgetLabel86)button.dataset.budgetLabel86=button.textContent||'';button.disabled=true;button.setAttribute('aria-busy','true');if(label)button.textContent=label;}else{button.disabled=false;button.removeAttribute('aria-busy');if(button.dataset.budgetLabel86){button.textContent=button.dataset.budgetLabel86;delete button.dataset.budgetLabel86;}}}

  async function refreshBudgetImport86(button){
    if(budgetImportBusy85)return;budgetImportBusy85=true;budgetImportButtonBusy86(button,true,'Refreshing…');budgetImportProgress85('Refreshing budget batches…',true);budgetImportRefreshStatus86('Refreshing…');
    try{budgetImportBundle85=null;const result=await loadBudgetImportBase86(true);budgetImportLastRefresh86=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});budgetImportRefreshStatus86(result?`Updated ${budgetImportLastRefresh86}`:'Refresh completed with no data.');return result;}
    catch(err){budgetImportRefreshStatus86('Refresh failed.');toast(err?.message||String(err));return null;}
    finally{budgetImportBusy85=false;budgetImportButtonBusy86(button,false);budgetImportProgress85('',false);}
  }

  async function downloadBudgetTemplate86(button){
    budgetImportButtonBusy86(button,true,'Preparing…');budgetImportRefreshStatus86('Preparing Excel template…');
    try{const XLSX=await ensureBudgetXlsx85(),wb=XLSX.utils.book_new(),currency=activeCurrency()||'USD',today=new Date().toISOString().slice(0,10),sheets={
      'Metadata':[['Key','Value'],['Version Label',`Budget ${new Date().getUTCFullYear()}`],['Currency',currency],['Effective From',today],['Effective To','']],
      'Project Budget':[['Project Code','Project Name','Donor','Currency','Personnel Budget','Effective From','Effective To'],['FIN-010','Example Project','Example Donor',currency,100000,today,'']],
      'Personnel Rates':[['Employee ID','Project Code','Hourly Rate','Currency','Effective From','Effective To'],['E001','FIN-010',100,currency,today,'']],
      'Donor Rules':[['Donor','Project Code','Rule Key','Numeric Value','Text Value','Effective From','Effective To'],['Example Donor','FIN-010','MAX_HOURLY_COST',150,'',today,''],['Example Donor','FIN-010','CURRENCY','',currency,today,''],['Example Donor','FIN-010','ALLOW_ADMIN','','no',today,'']]
    };
      for(const [name,rows] of Object.entries(sheets))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
      XLSX.writeFile(wb,'Assurance_Regent_Budget_Donor_Import_Template.xlsx');budgetImportRefreshStatus86('Template downloaded.');
    }catch(err){budgetImportRefreshStatus86('Template download failed.');toast(err?.message||String(err));}
    finally{budgetImportButtonBusy86(button,false);}
  }

  openBudgetImportView85=async function(){const result=await openBudgetImportViewBase86();ensureBudgetImportPolish86($(`view-${BUDGET_IMPORT_VIEW85}`));return result;};

  document.addEventListener('click',e=>{
    const page=e.target.closest?.('[data-budget-page86]');if(page){e.preventDefault();e.stopImmediatePropagation();const next=Number(page.dataset.budgetPage86||1);if(Number.isFinite(next)&&next>0){budgetImportPage86=next;renderBudgetImport85();}return;}
    const template=e.target.closest?.('[data-budget-template85]');if(template){e.preventDefault();e.stopImmediatePropagation();void downloadBudgetTemplate86(template);return;}
    const refresh=e.target.closest?.('[data-budget-refresh85]');if(refresh){e.preventDefault();e.stopImmediatePropagation();void refreshBudgetImport86(refresh);}
  },true);
  /* Assurance Regent v6.3.86 — Budget & Donor Import UI + control reliability END */
