  /* Assurance Regent v6.3.93 — Recovery Exceptions five-row pagination START */
  const RECOVERY_EXCEPTIONS_PAGINATION_SCHEMA93='6.3.93';
  const RECOVERY_EXCEPTIONS_PAGE_SIZE93=5;

  function recoveryExceptionsPager93(targetId='recoveryExceptionsBody',reset=false){
    const target=$(targetId);if(!target)return;const table=target.tagName==='TABLE'?target:target.closest('table');if(!table||!table.tBodies.length)return;
    const body=table.tBodies[0],allRows=[...body.rows],rows=allRows.filter(row=>!row.classList.contains('empty-row')),wrap=table.closest('.table-wrap');if(!wrap)return;
    let pager=wrap.nextElementSibling;
    if(!pager||!pager.classList.contains('table-pager')||pager.dataset.for!==targetId){pager=document.createElement('div');pager.className='table-pager';pager.dataset.for=targetId;wrap.insertAdjacentElement('afterend',pager);}
    if(reset||!pager.dataset.page)pager.dataset.page='1';
    allRows.forEach(row=>row.hidden=false);
    const totalRows=rows.length;
    if(totalRows<=RECOVERY_EXCEPTIONS_PAGE_SIZE93){pager.innerHTML='';pager.hidden=true;return;}
    pager.hidden=false;const totalPages=Math.max(1,Math.ceil(totalRows/RECOVERY_EXCEPTIONS_PAGE_SIZE93));let page=Math.max(1,Math.min(totalPages,Number(pager.dataset.page)||1));pager.dataset.page=String(page);
    const numberList=typeof paginationNumbers==='function'?paginationNumbers:(total,current)=>Array.from({length:total},(_,i)=>i+1);
    const draw=next=>{page=Math.max(1,Math.min(totalPages,next));pager.dataset.page=String(page);const start=(page-1)*RECOVERY_EXCEPTIONS_PAGE_SIZE93,end=start+RECOVERY_EXCEPTIONS_PAGE_SIZE93;rows.forEach((row,i)=>{row.hidden=i<start||i>=end;});const first=start+1,last=Math.min(end,totalRows),numbers=numberList(totalPages,page);pager.innerHTML=`<span class="pager-summary">Exceptions ${first}–${last} of ${totalRows}</span><div class="pager-controls"><button type="button" class="pager-button pager-arrow" data-page="${page-1}" ${page<=1?'disabled':''} aria-label="Previous exceptions page">←</button><div class="pager-pages">${numbers.map(n=>n==='…'?'<span class="pager-ellipsis">…</span>':`<button type="button" class="pager-button ${n===page?'active':''}" data-page="${n}" aria-label="Exceptions page ${n}" ${n===page?'aria-current="page"':''}>${n}</button>`).join('')}</div><button type="button" class="pager-button pager-arrow" data-page="${page+1}" ${page>=totalPages?'disabled':''} aria-label="Next exceptions page">→</button></div>`;pager.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>draw(Number(btn.dataset.page))));};
    draw(page);
  }

  const renderRecoveryExceptionsBase93=renderRecoveryExceptions;
  renderRecoveryExceptions=async function(){const result=await renderRecoveryExceptionsBase93();recoveryExceptionsPager93('recoveryExceptionsBody',true);return result;};

  window.AssuranceRegentRecoveryExceptionsPagination={version:RECOVERY_EXCEPTIONS_PAGINATION_SCHEMA93,pageSize:RECOVERY_EXCEPTIONS_PAGE_SIZE93,paginate:recoveryExceptionsPager93};
  /* Assurance Regent v6.3.93 — Recovery Exceptions five-row pagination END */
