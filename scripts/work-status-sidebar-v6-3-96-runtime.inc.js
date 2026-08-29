  /* Assurance Regent v6.3.96 — guaranteed Work Status sidebar START */
  const WORK_STATUS_SIDEBAR_SCHEMA96='6.3.96';

  workStatusAllowed95=function(){return Boolean(controlUser());};

  const ensureWorkStatusViewBase96=ensureWorkStatusView95;
  ensureWorkStatusView95=function(){
    const view=ensureWorkStatusViewBase96();
    const leaveNav=document.querySelector('.nav-item[data-view="leave"]');
    let nav=document.querySelector(`.nav-item[data-view="${WORK_STATUS_VIEW95}"]`);
    if(!nav&&leaveNav){
      nav=document.createElement('button');
      nav.type='button';
      nav.className='nav-item';
      nav.dataset.view=WORK_STATUS_VIEW95;
      nav.innerHTML='<span>⌖</span> Work Status';
      leaveNav.insertAdjacentElement('afterend',nav);
    }
    if(leaveNav)leaveNav.innerHTML='<span>☘</span> Leave';
    if(nav){
      nav.hidden=!Boolean(controlUser());
      if(!nav.dataset.workStatusBound96){
        nav.dataset.workStatusBound96='1';
        nav.addEventListener('click',event=>{event.preventDefault();switchView(WORK_STATUS_VIEW95);});
      }
      const group=nav.closest('.nav-group');
      if(group&&controlUser())group.hidden=false;
    }
    return view;
  };

  const applyAccessControlBase96=applyAccessControl;
  applyAccessControl=function(){
    const result=applyAccessControlBase96();
    ensureWorkStatusView95();
    const nav=document.querySelector(`.nav-item[data-view="${WORK_STATUS_VIEW95}"]`);
    if(nav)nav.hidden=!Boolean(controlUser());
    const group=nav?.closest('.nav-group');
    if(group&&controlUser())group.hidden=false;
    return result;
  };

  window.addEventListener('assurance-regent-session-ready',()=>{ensureWorkStatusView95();applyAccessControl();});
  ensureWorkStatusView95();
  /* Assurance Regent v6.3.96 — guaranteed Work Status sidebar END */