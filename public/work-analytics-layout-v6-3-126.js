/* Assurance Regent v6.3.126 — deterministic Work Analytics layout repair */
(() => {
  'use strict';

  const SCHEMA='6.3.126';
  let queued=false;

  function force(el,styles){
    if(!el)return;
    for(const [name,value] of Object.entries(styles))el.style.setProperty(name,String(value),'important');
  }

  function directChild(root,selector){
    return root ? [...root.children].find(el=>el.matches?.(selector))||null : null;
  }

  function normalizeEmployeeMonth(){
    const card=document.getElementById('mtsEmployeeMonth');
    if(!card)return;
    card.classList.add('mts-employee-month126');
    force(card,{
      display:'grid',
      'grid-template-columns':'minmax(0,1fr)',
      'grid-auto-rows':'auto',
      'align-content':'center',
      'justify-items':'center',
      gap:'9px',
      padding:'16px 18px',
      'min-height':'190px',
      height:'auto',
      overflow:'visible'
    });

    const star=directChild(card,'span:not(.user-identity)');
    const identity=directChild(card,'.user-identity');
    const metrics=directChild(card,'.winner-card-metrics');
    const score=directChild(card,'strong');
    const meta=directChild(card,'small');
    const emptyTitle=directChild(card,'b');

    if(star)star.remove();

    if(identity){
      identity.classList.add('mts-employee-identity126');
      force(identity,{
        display:'flex',
        'flex-direction':'row',
        'align-items':'center',
        'justify-content':'center',
        gap:'11px',
        width:'min(100%, 290px)',
        'max-width':'100%',
        'min-width':'0',
        margin:'0'
      });
      const avatar=identity.querySelector('.user-avatar');
      force(avatar,{width:'46px',height:'46px','flex':'0 0 46px',margin:'0'});
      const text=identity.querySelector('.user-identity-text');
      force(text,{
        display:'flex',
        'flex-direction':'column',
        'align-items':'flex-start',
        gap:'3px',
        width:'auto',
        'max-width':'220px',
        'min-width':'0',
        'text-align':'left'
      });
      const name=text?.querySelector('b');
      force(name,{
        display:'block',
        width:'100%',
        'max-width':'220px',
        margin:'0',
        color:'#1d5d70',
        'font-size':'10px',
        'font-weight':'800',
        'line-height':'1.3',
        'white-space':'normal',
        overflow:'visible',
        'text-overflow':'clip',
        'overflow-wrap':'anywhere'
      });
      const role=text?.querySelector('small');
      force(role,{
        display:'block',
        width:'100%',
        'max-width':'220px',
        margin:'0',
        color:'#7b8f98',
        'font-size':'7.5px',
        'line-height':'1.35',
        'white-space':'normal',
        overflow:'visible',
        'text-overflow':'clip',
        'overflow-wrap':'anywhere'
      });
    }

    if(metrics){
      metrics.classList.add('mts-employee-metrics126');
      force(metrics,{
        display:'grid',
        'grid-template-columns':'repeat(3,minmax(0,1fr))',
        'align-items':'stretch',
        width:'min(100%, 320px)',
        'max-width':'100%',
        margin:'4px 0 0',
        padding:'11px 0 0',
        'border-top':'1px solid #dfe9ed'
      });
      [...metrics.children].forEach((metric,index)=>{
        metric.classList.add('mts-employee-metric126');
        force(metric,{display:'flex','flex-direction':'column','align-items':'center','justify-content':'center',gap:'4px','min-width':'0',padding:'0 8px',margin:'0'});
        if(index>0)metric.style.setProperty('border-left','1px solid #dfe9ed','important');
        const value=metric.querySelector('strong');
        const label=metric.querySelector('small');
        value?.classList.add('mts-employee-metric-value126');
        label?.classList.add('mts-employee-metric-label126');
        force(value,{display:'block',margin:'0',color:'#234955','font-size':'10.5px','font-weight':'850','line-height':'1.1','text-align':'center','white-space':'normal','overflow-wrap':'anywhere'});
        force(label,{display:'block',margin:'0',color:'#718891','font-size':'7.2px','line-height':'1.3','text-align':'center','white-space':'normal','overflow-wrap':'anywhere'});
      });
    }

    if(score){
      score.classList.add('mts-employee-score126');
      force(score,{
        display:'block',
        width:'100%',
        'max-width':'290px',
        margin:'2px 0 0',
        color:'#203943',
        'font-size':'10.5px',
        'font-weight':'800',
        'line-height':'1.35',
        'text-align':'center',
        'white-space':'normal',
        overflow:'visible',
        'overflow-wrap':'anywhere'
      });
    }

    if(meta){
      meta.classList.add('mts-employee-meta126');
      force(meta,{
        display:'block',
        width:'100%',
        'max-width':'290px',
        margin:'0',
        color:'#81939b',
        'font-size':'7.5px',
        'line-height':'1.4',
        'text-align':'center',
        'white-space':'normal',
        overflow:'visible',
        'overflow-wrap':'anywhere'
      });
    }

    if(emptyTitle){
      emptyTitle.classList.add('mts-employee-empty-title126');
      force(emptyTitle,{margin:'0','font-size':'11px','line-height':'1.35','text-align':'center','white-space':'normal'});
    }

    card.dataset.layout126='ready';
  }

  function normalizeJobs(){
    const list=document.getElementById('mtsJobsList');
    if(!list)return;
    list.classList.add('mts-jobs-list126');
    force(list,{display:'grid',gap:'8px','align-content':'start','max-height':'174px',overflow:'auto'});

    [...list.children].forEach(row=>{
      if(row.tagName!=='DIV')return;
      row.classList.add('mts-job-row126');
      force(row,{
        display:'grid',
        'grid-template-columns':'minmax(0,1fr) auto',
        'align-items':'center',
        gap:'8px 12px',
        width:'100%',
        'min-width':'0',
        padding:'10px 11px',
        margin:'0',
        border:'1px solid #e1eaee',
        'border-radius':'9px',
        background:'#fbfdfe'
      });
      const copy=directChild(row,'span');
      if(copy){
        copy.classList.add('mts-job-copy126');
        force(copy,{display:'flex','flex-direction':'column',gap:'3px','min-width':'0'});
        const code=copy.querySelector('b');
        force(code,{display:'block',margin:'0',color:'#263f4a','font-size':'11px','line-height':'1.3','white-space':'normal','overflow-wrap':'anywhere'});
        const hours=copy.querySelector('small');
        force(hours,{display:'block',margin:'0',color:'#788d96','font-size':'8.5px','line-height':'1.35'});
      }
      const progress=directChild(row,'strong');
      if(progress){
        progress.classList.add('mts-job-progress126');
        force(progress,{display:'inline-flex','align-items':'center','justify-content':'center','min-width':'42px',padding:'5px 7px',margin:'0','border-radius':'8px',background:'#eaf6fa',color:'#22657a','font-size':'10px','font-weight':'850','line-height':'1','white-space':'nowrap'});
      }
      row.dataset.layout126='ready';
    });
  }

  function normalizeOvertime(){
    const list=document.getElementById('mtsOvertimeList');
    if(!list)return;
    list.classList.add('mts-overtime-list126');
    force(list,{display:'grid',gap:'8px','align-content':'start','max-height':'174px',overflow:'auto'});
    const empty=list.querySelector(':scope > .muted');
    force(empty,{margin:'12px 0 0',color:'#687f8a','font-size':'10px','line-height':'1.55','max-width':'32ch','white-space':'normal','overflow-wrap':'anywhere'});
    [...list.querySelectorAll(':scope > .risk-row')].forEach(row=>{
      force(row,{display:'flex','align-items':'center','justify-content':'space-between',gap:'12px',padding:'9px 10px',margin:'0'});
    });
  }

  function normalizeInsightPanels(){
    const grid=document.querySelector('.mts-insight-grid');
    if(!grid)return;
    force(grid,{gap:'14px','align-items':'stretch'});
    [...grid.children].forEach(panel=>force(panel,{'min-width':'0','min-height':'224px',height:'auto',padding:'16px'}));
  }

  function scan(){
    normalizeInsightPanels();
    normalizeEmployeeMonth();
    normalizeJobs();
    normalizeOvertime();
    document.documentElement.dataset.workAnalyticsLayout='6.3.126';
  }

  function queue(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;scan();});
  }

  function start(){
    scan();
    const observer=new MutationObserver(records=>{
      if(records.some(r=>r.type==='childList'&&r.addedNodes.length))queue();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('resize',queue,{passive:true});
    setTimeout(scan,200);
    setTimeout(scan,900);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.AssuranceRegentWorkAnalyticsLayout={
    schema:SCHEMA,
    employeeMonthSeparated:true,
    employeeMetricsSeparated:true,
    jobsRowsSeparated:true,
    legacyCssOverride:true,
    inlineImportantLayout:true,
    refresh:scan
  };
})();
