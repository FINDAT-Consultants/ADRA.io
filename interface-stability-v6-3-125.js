/* Assurance Regent v6.3.125 — dynamic interface normalization and clipping diagnostics */
(() => {
  'use strict';

  const SCHEMA='6.3.125';
  let scanQueued=false;
  const clipSelectors=[
    '.user-identity-text b',
    '.user-identity-text small',
    '.panel h1','.panel h2','.panel h3','.panel h4',
    '.panel p','.panel small',
    '.control-item-main b','.control-item-main p',
    '.company-person-summary b','.company-person-summary small',
    '.company-contact-list dd',
    '.leave-dashboard-kpi span',
    '.people-live-list article>small'
  ].join(',');

  function text(v){return String(v??'').trim();}

  function normalizeWorkAnalytics(root=document){
    const jobs=root.querySelector?.('#mtsJobsList')||document.getElementById('mtsJobsList');
    if(jobs){
      [...jobs.children].forEach(row=>{
        if(row.tagName==='DIV')row.classList.add('interface-analytics-row125');
      });
    }

    const overtime=root.querySelector?.('#mtsOvertimeList')||document.getElementById('mtsOvertimeList');
    if(overtime){
      [...overtime.children].forEach(row=>{
        if(row.classList?.contains('risk-row'))row.classList.add('interface-risk-row125');
      });
    }

    (root.querySelectorAll?.('.daily-pair>article')||[]).forEach(card=>card.classList.add('interface-daily-card125'));
  }

  function clipped(el){
    if(!(el instanceof HTMLElement)||!el.isConnected||el.hidden)return false;
    const value=text(el.textContent);if(!value)return false;
    const style=getComputedStyle(el);
    const constrained=style.overflowX==='hidden'||style.overflowX==='clip'||style.overflowY==='hidden'||style.overflowY==='clip'||style.whiteSpace==='nowrap';
    return constrained&&(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1);
  }

  function safeCardWrap(el){
    if(!(el instanceof HTMLElement))return false;
    if(el.closest('table,.table-wrap,.nav,.control-dock,.segmented-control,.chip,.result-chip,.status-badge,.btn,button'))return false;
    return Boolean(el.closest('.panel,.control-drawer,.modal,.company-workspace,.company-employee-card,.company-head-card,.developer-company-card'));
  }

  function forceSafeWrap(el){
    el.dataset.uiWrap125='true';
    el.style.setProperty('white-space','normal','important');
    el.style.setProperty('overflow','visible','important');
    el.style.setProperty('text-overflow','clip','important');
    el.style.setProperty('overflow-wrap','anywhere','important');
    el.style.setProperty('word-break','normal','important');
    el.style.setProperty('max-width','100%','important');
  }

  function annotateClipping(root=document){
    const nodes=[];
    if(root instanceof HTMLElement&&root.matches?.(clipSelectors))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll(clipSelectors));
    let clippedCount=0,autoWrappedCount=0;
    for(const el of nodes){
      let isClipped=clipped(el);
      if(isClipped&&safeCardWrap(el)){
        forceSafeWrap(el);
        autoWrappedCount++;
        isClipped=clipped(el);
      }
      el.dataset.uiClipped125=isClipped?'true':'false';
      if(isClipped){
        clippedCount++;
        const value=text(el.textContent);
        if(value&&!el.hasAttribute('title'))el.setAttribute('title',value);
      }
    }
    document.documentElement.dataset.interfaceClipped125=String(clippedCount);
    document.documentElement.dataset.interfaceAutoWrapped125=String(autoWrappedCount);
    return {clippedCount,autoWrappedCount};
  }

  function markSafeWrapTargets(root=document){
    const selectors=[
      '#mtsEmployeeMonth .user-identity-text b',
      '#mtsEmployeeMonth .user-identity-text small',
      '.leave-dashboard-kpi span',
      '.panel-head h3',
      '.panel-head p',
      '.company-detail-empty p',
      '.onboarding-empty p'
    ];
    for(const selector of selectors)(root.querySelectorAll?.(selector)||[]).forEach(el=>forceSafeWrap(el));
  }

  function scan(root=document){
    normalizeWorkAnalytics(root);
    markSafeWrapTargets(root);
    requestAnimationFrame(()=>annotateClipping(root===document?document:root));
  }

  function queueScan(root=document){
    if(scanQueued)return;scanQueued=true;
    queueMicrotask(()=>{scanQueued=false;scan(root);});
  }

  function start(){
    document.body?.classList.add('interface-stability-125');
    document.documentElement.dataset.interfaceStability='6.3.125';
    scan(document);
    const observer=new MutationObserver(records=>{
      let relevant=false;
      for(const record of records){
        if(record.type==='childList'&&record.addedNodes.length){relevant=true;break;}
      }
      if(relevant)queueScan(document);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('resize',()=>queueScan(document),{passive:true});
    window.addEventListener('orientationchange',()=>queueScan(document),{passive:true});
    setTimeout(()=>scan(document),250);
    setTimeout(()=>scan(document),1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.AssuranceRegentInterfaceStability={
    schema:SCHEMA,
    systemWideDensityPass:true,
    rendererCssDriftFixes:true,
    employeeMonthOverlapFix:true,
    jobsAnalyticsRowFix:true,
    dailyEvidenceMarkupFix:true,
    dynamicClippingDiagnostics:true,
    cardAutoWrap:true,
    forceSafeWrap:true,
    clippedCount:()=>Number(document.documentElement.dataset.interfaceClipped125||0),
    autoWrappedCount:()=>Number(document.documentElement.dataset.interfaceAutoWrapped125||0),
    refresh:()=>scan(document)
  };
})();
/* Explicit source trigger: publish the v6.3.125 interface artifact after the workflow exists on main. */
