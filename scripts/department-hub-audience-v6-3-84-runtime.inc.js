  /* Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking START */
  let companyHubAudienceObserver84=null,companyHubAudienceAttachTimer84=null;
  const companyHubAudienceTimers84=new Map(),companyHubAudienceMediaTimers84=new WeakMap();

  function ensureCompanyHubAudienceStyles84(){
    if($('companyHubAudienceStyles84'))return;
    const style=document.createElement('style');style.id='companyHubAudienceStyles84';
    style.textContent=`
      .company-social-reaction-faces.audience84{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .company-social-reactor-preview84{display:flex;align-items:center;gap:4px}
      .company-social-reactor-preview84 .company-social-reactor-avatar{position:relative}
      .company-social-reactor-preview84 .reaction84{font-size:12px;line-height:1}
      .company-social-reactions-more84{border:0;background:transparent;color:var(--accent,#087ea4);font:inherit;font-weight:750;cursor:pointer;padding:4px 6px;border-radius:8px;white-space:nowrap}
      .company-social-reactions-more84:hover{background:rgba(8,126,164,.08)}
      .company-social-reaction-dialog84{border:0;border-radius:20px;padding:0;width:min(520px,calc(100vw - 28px));max-height:min(720px,calc(100vh - 32px));box-shadow:0 24px 80px rgba(10,35,48,.28);background:#fff;color:#102f3e}
      .company-social-reaction-dialog84::backdrop{background:rgba(12,31,41,.48);backdrop-filter:blur(2px)}
      .company-social-reaction-shell84{display:flex;flex-direction:column;max-height:min(720px,calc(100vh - 32px))}
      .company-social-reaction-head84{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid #e4edf1}
      .company-social-reaction-head84 div{display:grid;gap:3px}.company-social-reaction-head84 h3{margin:0;font-size:19px}.company-social-reaction-head84 small{color:#688291}
      .company-social-reaction-close84{width:36px;height:36px;border-radius:50%;border:1px solid #dbe7ec;background:#fff;cursor:pointer;font-size:20px}
      .company-social-reaction-list84{overflow:auto;padding:8px 14px 14px;min-height:120px;max-height:520px}
      .company-social-reaction-person84{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:11px;padding:11px 6px;border-bottom:1px solid #edf3f6}
      .company-social-reaction-person84:last-child{border-bottom:0}
      .company-social-reaction-person84 .avatar84{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:#eaf3f6;font-weight:800}
      .company-social-reaction-person84 .avatar84 img{width:100%;height:100%;object-fit:cover}
      .company-social-reaction-person84 .copy84{display:grid;gap:2px;min-width:0}.company-social-reaction-person84 .copy84 b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.company-social-reaction-person84 .copy84 small{color:#6e8794;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .company-social-reaction-person84 .kind84{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:750;white-space:nowrap}.company-social-reaction-person84 .kind84 span{font-size:18px}
      .company-social-reaction-loading84,.company-social-reaction-empty84{padding:28px;text-align:center;color:#6d8490}
      @media(max-width:560px){.company-social-reaction-person84{grid-template-columns:38px minmax(0,1fr)}.company-social-reaction-person84 .kind84{grid-column:2}.company-social-reaction-list84{max-height:62vh}}
    `;
    document.head.appendChild(style);
  }

  function companyHubReactionPreview84(row={}){
    const people=Array.isArray(row.reactionPeople)?row.reactionPeople:[],total=companySocialReactionTotal(row);
    if(!people.length&&!total)return '';
    const shown=people.slice(0,3);
    return `<div class="company-social-reaction-faces audience84" aria-label="People who reacted">${shown.map(person=>`<span class="company-social-reactor-preview84">${companyHubReactionAvatarMarkup(person,String(person.emoji||'👍'))}<span class="reaction84" title="${esc(companySocialReactionInfo(String(person.emoji||'👍')).label)}">${esc(String(person.emoji||'👍'))}</span></span>`).join('')}${total>3?`<button type="button" class="company-social-reactions-more84" data-social-reactions-more84="${esc(row.id||'')}">+ See more</button>`:''}</div>`;
  }
  companyHubReactionFacesMarkup=function(row={}){return companyHubReactionPreview84(row);};

  function companyHubReactionDialog84(){
    let dlg=$('companyHubReactionDialog84');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='companyHubReactionDialog84';dlg.className='company-social-reaction-dialog84';
    dlg.innerHTML='<div class="company-social-reaction-shell84"><header class="company-social-reaction-head84"><div><h3>Reactions</h3><small data-reaction-total84>Loading…</small></div><button type="button" class="company-social-reaction-close84" data-reaction-close84 aria-label="Close reactions">×</button></header><div class="company-social-reaction-list84" data-reaction-list84><div class="company-social-reaction-loading84">Loading reactions…</div></div></div>';
    dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
    document.body.appendChild(dlg);return dlg;
  }
  function companyHubReactionPersonRow84(person={}){
    const name=String(person.name||person.userId||'Colleague'),photo=safeProfilePhoto(person.profilePhoto||''),position=String(person.position||'Company member'),emoji=String(person.emoji||'👍'),info=companySocialReactionInfo(emoji);
    return `<div class="company-social-reaction-person84"><span class="avatar84">${photo?`<img src="${esc(photo)}" alt="${esc(name)}"/>`:esc(companyHubSocialLayerInitials(name))}</span><span class="copy84"><b>${esc(name)}</b><small>${esc(position)}</small></span><span class="kind84"><span>${esc(emoji)}</span>${esc(info.label)}</span></div>`;
  }
  async function openCompanyHubReactions84(messageId){
    const id=String(messageId||'');if(!id)return;
    ensureCompanyHubAudienceStyles84();const dlg=companyHubReactionDialog84(),list=dlg.querySelector('[data-reaction-list84]'),total=dlg.querySelector('[data-reaction-total84]');
    if(list)list.innerHTML='<div class="company-social-reaction-loading84">Loading reactions…</div>';if(total)total.textContent='Loading…';if(!dlg.open)dlg.showModal();
    try{
      const data=await supabaseRpc('assurance_regent_browser_department_social_reactors',{p_token:browserSessionToken,p_message_id:id,p_company_id:departmentHubContextCompanyId()},{bypassCache:true});
      const people=Array.isArray(data?.people)?data.people:[],count=Number(data?.total??people.length);
      if(total)total.textContent=`${count} ${count===1?'person':'people'} reacted`;
      if(list)list.innerHTML=people.length?people.map(companyHubReactionPersonRow84).join(''):'<div class="company-social-reaction-empty84">No reactions yet.</div>';
    }catch(err){if(total)total.textContent='Reactions unavailable';if(list)list.innerHTML='<div class="company-social-reaction-empty84">Could not load reaction details.</div>';console.warn('Reaction details unavailable',err);}
  }

  function companyHubAudienceRoot84(){
    const main=document.querySelector('.company-social-main');if(!main)return null;
    try{const style=getComputedStyle(main),overflow=String(style.overflowY||style.overflow||'');return /(auto|scroll|overlay)/i.test(overflow)?main:null;}catch{return null;}
  }
  function companyHubAudienceVisibleRatio84(el,root=null){
    if(!el?.isConnected)return 0;const r=el.getBoundingClientRect(),clip=root?.getBoundingClientRect?.()||{top:0,left:0,right:innerWidth,bottom:innerHeight};
    const left=Math.max(r.left,clip.left),right=Math.min(r.right,clip.right),top=Math.max(r.top,clip.top),bottom=Math.min(r.bottom,clip.bottom),visible=Math.max(0,right-left)*Math.max(0,bottom-top),area=Math.max(1,r.width*r.height);return Math.max(0,Math.min(1,visible/area));
  }
  function companyHubAudiencePostId84(node){return String(node?.closest?.('[data-social-post-card]')?.dataset?.socialPostCard||'');}
  function companyHubAudienceRecord84(messageId){const id=String(messageId||'');if(!id||!browserSessionToken)return;try{const work=companyHubRecordView62(id);if(work?.catch)work.catch(()=>{});}catch{}}
  function companyHubAudienceCancel84(id){const timer=companyHubAudienceTimers84.get(id);if(timer)clearTimeout(timer);companyHubAudienceTimers84.delete(id);}
  function companyHubAudienceSchedule84(card,root){
    const id=String(card?.dataset?.socialPostCard||'');if(!id||companyHubAudienceTimers84.has(id))return;
    companyHubAudienceTimers84.set(id,setTimeout(()=>{companyHubAudienceTimers84.delete(id);if(document.hidden||!card?.isConnected)return;if(companyHubAudienceVisibleRatio84(card,root)>=.38)companyHubAudienceRecord84(id);},800));
  }
  function attachCompanyHubAudience84(){
    if(companyHubAudienceObserver84){companyHubAudienceObserver84.disconnect();companyHubAudienceObserver84=null;}for(const id of [...companyHubAudienceTimers84.keys()])companyHubAudienceCancel84(id);
    if(!document.body.classList.contains('department-hub-social-mode')||!('IntersectionObserver'in window))return;
    const cards=[...document.querySelectorAll('.company-social-post[data-social-post-card]')];if(!cards.length)return;const root=companyHubAudienceRoot84();
    companyHubAudienceObserver84=new IntersectionObserver(entries=>{for(const entry of entries){const id=String(entry.target?.dataset?.socialPostCard||'');if(!id)continue;if(entry.isIntersecting&&entry.intersectionRatio>=.42)companyHubAudienceSchedule84(entry.target,root);else companyHubAudienceCancel84(id);}},{root,threshold:[0,.2,.42,.62,.82,1]});cards.forEach(card=>companyHubAudienceObserver84.observe(card));
  }
  function scheduleCompanyHubAudience84(delay=70){clearTimeout(companyHubAudienceAttachTimer84);companyHubAudienceAttachTimer84=setTimeout(attachCompanyHubAudience84,delay);}
  function companyHubAudienceMedia84(media,kind='media'){
    if(!media||companyHubAudienceMediaTimers84.has(media))return;const id=companyHubAudiencePostId84(media);if(!id)return;
    const timer=setTimeout(()=>{companyHubAudienceMediaTimers84.delete(media);if(!media.isConnected)return;const active=media instanceof HTMLMediaElement?!media.paused&&!media.ended:true;if(active)companyHubAudienceRecord84(id);},kind==='video'?1000:400);companyHubAudienceMediaTimers84.set(media,timer);
  }

  if(!window.__assuranceRegentDepartmentAudience84){
    window.__assuranceRegentDepartmentAudience84=true;ensureCompanyHubAudienceStyles84();
    const mutation=new MutationObserver(records=>{if(document.body.classList.contains('department-hub-social-mode')&&records.some(r=>r.addedNodes?.length||r.removedNodes?.length))scheduleCompanyHubAudience84(100);});mutation.observe(document.body,{subtree:true,childList:true});
    document.addEventListener('click',e=>{
      const more=e.target.closest?.('[data-social-reactions-more84]');if(more){e.preventDefault();e.stopPropagation();void openCompanyHubReactions84(more.dataset.socialReactionsMore84);return;}
      if(e.target.closest?.('[data-reaction-close84]')){e.preventDefault();companyHubReactionDialog84().close();return;}
      const react=e.target.closest?.('[data-social-react]');if(react){const id=String(react.dataset.socialPost||'');const root=resolveCompanySocialRoot?.(id)||id;companyHubAudienceRecord84(root);return;}
      const comments=e.target.closest?.('[data-social-comments-toggle],[data-social-comment-reply],[data-company-post-open-comments]');if(comments){const id=companyHubAudiencePostId84(comments)||String(comments.dataset.socialCommentsToggle||comments.dataset.socialCommentReply||'');if(id)companyHubAudienceRecord84(resolveCompanySocialRoot?.(id)||id);return;}
      const image=e.target.closest?.('.company-social-media.image,[data-media-kind="image"]');if(image){const id=companyHubAudiencePostId84(image);if(id)companyHubAudienceRecord84(id);return;}
      const file=e.target.closest?.('[data-company-hub-file]');if(file){const id=companyHubAudiencePostId84(file);if(id)companyHubAudienceRecord84(id);}
    },true);
    document.addEventListener('submit',e=>{const form=e.target?.closest?.('[data-social-comment-form]');if(form){const id=String(form.dataset.socialRoot||'');if(id)companyHubAudienceRecord84(id);}},true);
    document.addEventListener('play',e=>{const media=e.target;if(media instanceof HTMLMediaElement)companyHubAudienceMedia84(media,media.tagName==='VIDEO'?'video':'audio');},true);
    document.addEventListener('pause',e=>{const media=e.target,timer=companyHubAudienceMediaTimers84.get(media);if(timer){clearTimeout(timer);companyHubAudienceMediaTimers84.delete(media);}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const id of [...companyHubAudienceTimers84.keys()])companyHubAudienceCancel84(id);}else scheduleCompanyHubAudience84(100);});
    window.addEventListener('resize',()=>scheduleCompanyHubAudience84(160));
    const renderCompanyHubBase84=renderCompanyHub;renderCompanyHub=function(...args){const out=renderCompanyHubBase84.apply(this,args);queueMicrotask(()=>scheduleCompanyHubAudience84(35));return out;};
    scheduleCompanyHubAudience84(120);
  }
  /* Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking END */
