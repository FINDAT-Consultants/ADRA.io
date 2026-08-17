  /* Assurance Regent v6.3.75 — Work Activity table column integrity START */
  function workActivityTableHeaderKey75(value=''){
    return String(value||'').trim().toLowerCase().replace(/[\s_]+/gu,'-').replace(/-+/gu,'-');
  }
  function workActivityTableColumnIndexes75(table=$('mtsTable')){
    const headers=[...(table?.querySelectorAll('thead th')||[])],find=(...labels)=>headers.findIndex(th=>labels.includes(workActivityTableHeaderKey75(th.textContent)));
    return {
      clockOut:find('clock-out','clockout'),
      progress:find('progress'),
      totalHours:find('total-hours','hours'),
      hourlyRate:find('hourly-rate'),
      operationalCost:find('operational-cost')
    };
  }
  function repairWorkActivityIndividualColumns75(){
    const table=$('mtsTable');if(!table||state.mtsMode!=='individual')return;
    const indexes=workActivityTableColumnIndexes75(table),rows=[...filteredMtsSessions()].sort((a,b)=>String(b.clock_in_at||'').localeCompare(String(a.clock_in_at||''))),trs=[...table.querySelectorAll('tbody tr:not(.empty-row)')];
    trs.forEach((tr,index)=>{
      const row=rows[index];if(!row)return;const cells=tr.children,canClock=['active','rework_required'].includes(row.status),finished=['completed','rework_required'].includes(row.status);
      if(indexes.clockOut>=0&&cells[indexes.clockOut])cells[indexes.clockOut].innerHTML=canClock?`<button class="btn micro primary" data-mts-clockout="${esc(row.id)}">${row.status==='rework_required'?'Clock Out Rework':'Clock Out'}</button>`:formatTime(row.clock_out_at);
      if(indexes.progress>=0&&cells[indexes.progress])cells[indexes.progress].innerHTML=workActivityProgressMarkup73(row);
      if(indexes.totalHours>=0&&cells[indexes.totalHours])cells[indexes.totalHours].innerHTML=finished?num(row.duration_hours,2):'—';
      if(indexes.hourlyRate>=0&&cells[indexes.hourlyRate])cells[indexes.hourlyRate].innerHTML=workActivityRateMarkup73(row);
      if(indexes.operationalCost>=0&&cells[indexes.operationalCost])cells[indexes.operationalCost].innerHTML=finished?workActivityCostMarkup73(row):'—';
    });
  }
  const baseRenderMtsTable75=renderMtsTable;
  renderMtsTable=function(){const result=baseRenderMtsTable75();repairWorkActivityIndividualColumns75();return result;};
  /* Assurance Regent v6.3.75 — Work Activity table column integrity END */
