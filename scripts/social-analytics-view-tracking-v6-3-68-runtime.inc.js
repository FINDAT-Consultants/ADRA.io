  /* Assurance Regent v6.3.68 — reliable Department Hub social view tracking START */
  let companyHubReliableViewObserver68=null,companyHubReliableViewMutation68=null,companyHubReliableViewBound68=false,companyHubReliableRebindTimer68=null;
  const companyHubReliableViewTimers68=new Map(),companyHubReliableMediaTimers68=new WeakMap();

  function companyHubReliableViewRoot68(){
    const main=document.querySelector('.company-social-main');
    if(!main)return null;
    try{const style=getComputedStyle(main),overflow=String(style.overflowY||style.overflow||'');return /(auto|scroll|overlay)/i.test(overflow)?main:null;}catch{return null;}
  }
  function companyHubReliableVisibleRatio68(el,root=null){
    if(!el?.isConnected)return 0;
    const r=el.getBoundingClientRect(),clip=root?.getBoundingClientRect?.()||{top:0,left:0,right:window.innerWidth,bottom:window.innerHeight};
    const left=Math.max(r.left,clip.left),right=Math.min(r.right,clip.right),top=Math.max(r.top,clip.top),bottom=Math.min(r.bottom,clip.bottom),visible=Math.max(0,right-left)*Math.max(0,bottom-top),area=Math.max(1,r.width*r.height);
    return Math.max(0,Math.min(1,visible/area));
  }
  function companyHubReliablePostId68(node){const card=node?.closest?.('[data-social-post-card]');return String(card?.dataset?.socialPostCard||'');}
  function companyHubReliableRecord68(messageId,reason='feed'){
    const id=String(messageId||'');if(!id||!browserSessionToken)return;
    try{const result=companyHubRecordView62?.(id);if(result?.catch)result.catch(err=>console.warn(`Department Hub ${reason} view could not be recorded:`,err));}catch(err){console.warn(`Department Hub ${reason} view could not be recorded:`,err);}
  }
  function companyHubReliableCancelTimer68(id){const timer=companyHubReliableViewTimers68.get(id);if(timer)clearTimeout(timer);companyHubReliableViewTimers68.delete(id);}
  function companyHubReliableScheduleCard68(card,root){
    const id=String(card?.dataset?.socialPostCard||'');if(!id||companyHubReliableViewTimers68.has(id))return;
    companyHubReliableViewTimers68.set(id,setTimeout(()=>{
      companyHubReliableViewTimers68.delete(id);
      if(document.hidden||!card?.isConnected)return;
      if(companyHubReliableVisibleRatio68(card,root)>=.38)companyHubReliableRecord68(id,'qualified-feed');
    },800));
  }
  function companyHubReliableAttach68(){
    if(companyHubReliableViewObserver68){companyHubReliableViewObserver68.disconnect();companyHubReliableViewObserver68=null;}
    for(const id of [...companyHubReliableViewTimers68.keys()])companyHubReliableCancelTimer68(id);
    if(!document.body.classList.contains('department-hub-social-mode')||!('IntersectionObserver'in window))return;
    const cards=[...document.querySelectorAll('.company-social-post[data-social-post-card]')];if(!cards.length)return;
    const root=companyHubReliableViewRoot68();
    companyHubReliableViewObserver68=new IntersectionObserver(entries=>{
      for(const entry of entries){const id=String(entry.target?.dataset?.socialPostCard||'');if(!id)continue;if(entry.isIntersecting&&entry.intersectionRatio>=.42)companyHubReliableScheduleCard68(entry.target,root);else companyHubReliableCancelTimer68(id);}
    },{root,threshold:[0,.2,.42,.62,.82,1]});
    cards.forEach(card=>companyHubReliableViewObserver68.observe(card));
  }
  function companyHubReliableScheduleAttach68(delay=60){clearTimeout(companyHubReliableRebindTimer68);companyHubReliableRebindTimer68=setTimeout(companyHubReliableAttach68,delay);}
  function companyHubReliableMediaConsumed68(media,kind='media'){
    if(!media||companyHubReliableMediaTimers68.has(media))return;
    const id=companyHubReliablePostId68(media);if(!id)return;
    const timer=setTimeout(()=>{companyHubReliableMediaTimers68.delete(media);if(!media.isConnected)return;const active=media instanceof HTMLMediaElement?!media.paused&&!media.ended:true;if(active)companyHubReliableRecord68(id,kind);},kind==='video'?1200:450);
    companyHubReliableMediaTimers68.set(media,timer);
  }
  function bindCompanyHubReliableViewTracking68(){
    if(companyHubReliableViewBound68)return;companyHubReliableViewBound68=true;
    companyHubReliableViewMutation68=new MutationObserver(records=>{if(!document.body.classList.contains('department-hub-social-mode'))return;if(records.some(r=>r.addedNodes?.length||r.removedNodes?.length))companyHubReliableScheduleAttach68(90);});
    companyHubReliableViewMutation68.observe(document.body,{subtree:true,childList:true});
    document.addEventListener('click',e=>{
      const image=e.target.closest?.('.company-social-media.image,[data-media-kind="image"]');if(image){const id=companyHubReliablePostId68(image);if(id)companyHubReliableRecord68(id,'image-open');return;}
      const file=e.target.closest?.('[data-company-hub-file]');if(file){const id=companyHubReliablePostId68(file);if(id)companyHubReliableRecord68(id,'attachment-open');return;}
      const comments=e.target.closest?.('[data-social-comments-toggle],[data-social-reply],[data-company-post-open-comments]');if(comments){const id=companyHubReliablePostId68(comments);if(id)companyHubReliableRecord68(id,'post-open');}
    },true);
    document.addEventListener('play',e=>{const media=e.target;if(!(media instanceof HTMLMediaElement))return;const id=companyHubReliablePostId68(media);if(!id)return;companyHubReliableMediaConsumed68(media,media.tagName==='VIDEO'?'video':'audio');},true);
    document.addEventListener('pause',e=>{const media=e.target,timer=companyHubReliableMediaTimers68.get(media);if(timer){clearTimeout(timer);companyHubReliableMediaTimers68.delete(media);}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const id of [...companyHubReliableViewTimers68.keys()])companyHubReliableCancelTimer68(id);}else companyHubReliableScheduleAttach68(120);});
    window.addEventListener('resize',()=>companyHubReliableScheduleAttach68(160));
    const baseRender68=renderCompanyHub;
    renderCompanyHub=function(...args){const out=baseRender68.apply(this,args);queueMicrotask(()=>companyHubReliableScheduleAttach68(30));return out;};
    companyHubReliableScheduleAttach68(120);
  }
  bindCompanyHubReliableViewTracking68();
  /* Assurance Regent v6.3.68 — reliable Department Hub social view tracking END */
