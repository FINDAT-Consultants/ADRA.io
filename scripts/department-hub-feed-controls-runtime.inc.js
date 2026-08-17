  /* Assurance Regent v6.3.55 — compact composer, inline audio playback and post menus START */
  let companyHubFeedControlsBound55=false,companyHubFeedControlsObserver55=null;

  function companyHubPostRow55(messageId){
    const id=String(messageId||'');
    for(const rows of [state.companyHubMessages,state.companyHubProjectNews]){
      const row=(Array.isArray(rows)?rows:[]).find(x=>String(x?.id||'')===id);
      if(row)return row;
    }
    return null;
  }

  function companyHubAudioMarkup55(fileId,name){
    return `<div class="company-hub-inline-audio-post" data-company-inline-audio-player="${esc(fileId)}"><button type="button" class="company-hub-inline-audio-toggle" data-company-audio-toggle disabled aria-label="Play audio">▶<span>Play</span></button><div class="company-hub-inline-audio-post-meta"><b>${esc(name||'Audio')}</b><small data-company-audio-status>Preparing audio…</small></div><span class="company-hub-inline-audio-post-time"><span data-company-audio-current>0:00</span> / <span data-company-audio-duration>0:00</span></span><div class="company-hub-inline-audio-wave-wrap"><canvas height="38" data-company-audio-waveform aria-label="Audio waveform"></canvas><input type="range" min="0" max="0" step="0.01" value="0" data-company-audio-seek aria-label="Audio timeline" /></div><audio preload="metadata" playsinline data-company-audio-element></audio></div>`;
  }

  async function companyHubHydrateInlineAudio55(host,fileId,att){
    if(!host||host.dataset.companyAudioHydrating==='1'||host.dataset.companyAudioReady==='1')return;
    host.dataset.companyAudioHydrating='1';
    const audio=host.querySelector('[data-company-audio-element]'),toggle=host.querySelector('[data-company-audio-toggle]'),seek=host.querySelector('[data-company-audio-seek]'),current=host.querySelector('[data-company-audio-current]'),duration=host.querySelector('[data-company-audio-duration]'),canvas=host.querySelector('[data-company-audio-waveform]'),status=host.querySelector('[data-company-audio-status]');
    if(!audio||!toggle||!seek||!canvas)return;
    let peaks=[];
    const sync=()=>{
      const d=Number(audio.duration||0),c=Number(audio.currentTime||0),progress=Number.isFinite(d)&&d>0?Math.max(0,Math.min(1,c/d)):0;
      seek.max=Number.isFinite(d)&&d>0?String(d):'0';
      if(document.activeElement!==seek)seek.value=Number.isFinite(c)?String(c):'0';
      if(current)current.textContent=companyHubInlineTime54(c);
      if(duration)duration.textContent=companyHubInlineTime54(d);
      toggle.innerHTML=audio.paused?'▶<span>Play</span>':'Ⅱ<span>Pause</span>';
      toggle.setAttribute('aria-label',audio.paused?'Play audio':'Pause audio');
      host.classList.toggle('is-playing',!audio.paused&&!audio.ended);
      companyHubDrawWaveform54(canvas,peaks,progress);
    };
    try{
      const stored=await persistentFileDownload(String(fileId||''));
      if(!host.isConnected)return;
      audio.src=stored.url;
      audio.load();
      if(status)status.textContent='Audio · Play in Department Hub';
      toggle.disabled=false;
      host.dataset.companyAudioReady='1';
      toggle.addEventListener('click',async()=>{
        if(audio.paused){
          for(const other of document.querySelectorAll('.company-hub-inline-audio-post audio[data-company-audio-element]'))if(other!==audio&&!other.paused)other.pause();
          try{await audio.play();}catch(err){toast(err?.message||'This audio could not start playing.');}
        }else audio.pause();
        sync();
      });
      seek.addEventListener('input',()=>{
        const d=Number(audio.duration||0),v=Number(seek.value||0);
        if(Number.isFinite(d)&&d>0&&Number.isFinite(v))audio.currentTime=Math.max(0,Math.min(v,d));
        sync();
      });
      canvas.parentElement?.addEventListener('dblclick',e=>{
        const d=Number(audio.duration||0);if(!Number.isFinite(d)||d<=0)return;
        const r=canvas.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width)));
        audio.currentTime=ratio*d;sync();
      });
      for(const ev of ['loadedmetadata','durationchange','timeupdate','seeked','play','pause','ended'])audio.addEventListener(ev,sync);
      companyHubWavePeaks54(stored,canvas,p=>{peaks=Array.isArray(p)?p:[];sync();});
      requestAnimationFrame(sync);
    }catch(err){
      host.classList.add('is-error');
      toggle.disabled=true;
      if(status)status.textContent=err?.message||'Audio unavailable';
      console.warn('Department Hub inline audio unavailable',err);
    }finally{
      host.dataset.companyAudioHydrating='0';
    }
  }

  function companyHubDecorateInlineAudio55(){
    if(!document.body.classList.contains('department-hub-social-mode'))return;
    for(const node of document.querySelectorAll('button.company-hub-inline-audio-card[data-company-inline-audio]')){
      const id=String(node.dataset.companyInlineAudio||'');if(!id)continue;
      const att=companyHubInlineAttachment54(id,node),name=String(att?.name||'Audio');
      const shell=document.createElement('div');
      shell.innerHTML=companyHubAudioMarkup55(id,name);
      const host=shell.firstElementChild;
      node.replaceWith(host);
      companyHubHydrateInlineAudio55(host,id,att).catch(()=>{});
    }
    for(const host of document.querySelectorAll('.company-hub-inline-audio-post[data-company-inline-audio-player]')){
      if(host.dataset.companyAudioReady!=='1'&&host.dataset.companyAudioHydrating!=='1'){
        const id=String(host.dataset.companyInlineAudioPlayer||'');
        companyHubHydrateInlineAudio55(host,id,companyHubInlineAttachment54(id,host)).catch(()=>{});
      }
    }
  }

  function companyHubPostMenuMarkup55(post){
    const id=String(post?.id||''),mine=String(post?.senderId||'')===String(controlUser()?.id||'');
    return `<div class="company-social-post-menu-wrap" data-company-post-menu-wrap><button type="button" class="company-social-post-menu-toggle" data-company-post-menu-toggle="${esc(id)}" aria-label="Post options" aria-expanded="false">⋯</button><div class="company-social-post-menu" data-company-post-menu="${esc(id)}" hidden><button type="button" data-company-post-open-comments="${esc(id)}">💬 <span>Open comments</span></button><button type="button" data-company-post-copy="${esc(id)}">⧉ <span>Copy post text</span></button>${mine?`<button type="button" class="danger" data-company-post-delete="${esc(id)}">🗑 <span>Delete post</span></button>`:''}</div></div>`;
  }

  function companyHubDecoratePostMenus55(){
    if(!document.body.classList.contains('department-hub-social-mode'))return;
    for(const card of document.querySelectorAll('.company-social-post[data-social-post-card]')){
      if(card.querySelector('[data-company-post-menu-wrap]'))continue;
      const id=String(card.dataset.socialPostCard||''),post=companyHubPostRow55(id),header=card.querySelector('.company-social-post-body>header');
      if(!id||!post||!header)continue;
      header.insertAdjacentHTML('beforeend',companyHubPostMenuMarkup55(post));
    }
  }

  function companyHubClosePostMenus55(except=''){
    for(const menu of document.querySelectorAll('[data-company-post-menu]')){
      const keep=except&&String(menu.dataset.companyPostMenu||'')===String(except);
      menu.hidden=!keep;
      const toggle=document.querySelector(`[data-company-post-menu-toggle="${CSS.escape(String(menu.dataset.companyPostMenu||''))}"]`);
      toggle?.setAttribute('aria-expanded',keep?'true':'false');
    }
  }

  async function companyHubDeletePost55(messageId,button){
    const id=String(messageId||''),post=companyHubPostRow55(id),me=String(controlUser()?.id||'');
    if(!post||String(post.senderId||'')!==me){toast('You can delete only posts you created.');return;}
    if(!window.confirm('Delete this post? Its comments and attachments used only by this post will also be removed.'))return;
    if(button)button.disabled=true;
    try{
      await supabaseRpc('assurance_regent_browser_department_social_delete',{p_token:browserSessionToken,p_message_id:id,p_company_id:departmentHubContextCompanyId()},{bypassCache:true});
      try{companySocialOpenThreads.delete(id);}catch{}
      try{companyHubProjectNewsLoadedCompany53='';companyHubProjectNewsRows53=[];}catch{}
      await loadCompanyHubMessages(state.companyHubDepartment,true);
      toast('Post deleted.');
    }catch(err){toast(err?.message||'Could not delete this post.');}
    finally{if(button)button.disabled=false;}
  }

  function renderCompanyHubFeedControls55(){
    queueMicrotask(()=>{companyHubDecorateInlineAudio55();companyHubDecoratePostMenus55();});
    setTimeout(()=>{companyHubDecorateInlineAudio55();companyHubDecoratePostMenus55();},140);
  }

  function bindCompanyHubFeedControlsUi55(){
    if(companyHubFeedControlsBound55)return;
    companyHubFeedControlsBound55=true;
    document.addEventListener('click',e=>{
      const toggle=e.target.closest('[data-company-post-menu-toggle]');
      if(toggle){
        e.preventDefault();e.stopPropagation();
        const id=String(toggle.dataset.companyPostMenuToggle||''),menu=document.querySelector(`[data-company-post-menu="${CSS.escape(id)}"]`),open=Boolean(menu&&!menu.hidden);
        companyHubClosePostMenus55(open?'':id);
        return;
      }
      const comments=e.target.closest('[data-company-post-open-comments]');
      if(comments){
        e.preventDefault();
        const card=comments.closest('[data-social-post-card]'),button=card?.querySelector('[data-social-comments-toggle]');
        companyHubClosePostMenus55();button?.click();return;
      }
      const copy=e.target.closest('[data-company-post-copy]');
      if(copy){
        e.preventDefault();
        const post=companyHubPostRow55(copy.dataset.companyPostCopy),text=String(post?.content||'').trim();
        companyHubClosePostMenus55();
        if(!text){toast('This post has no text to copy.');return;}
        navigator.clipboard?.writeText(text).then(()=>toast('Post text copied.')).catch(()=>toast('Could not copy the post text.'));
        return;
      }
      const del=e.target.closest('[data-company-post-delete]');
      if(del){e.preventDefault();companyHubClosePostMenus55();companyHubDeletePost55(del.dataset.companyPostDelete,del).catch(()=>{});return;}
      if(!e.target.closest('[data-company-post-menu-wrap]'))companyHubClosePostMenus55();
    });
    companyHubFeedControlsObserver55=new MutationObserver(()=>{
      if(document.body.classList.contains('department-hub-social-mode'))queueMicrotask(()=>{companyHubDecorateInlineAudio55();companyHubDecoratePostMenus55();});
    });
    companyHubFeedControlsObserver55.observe(document.body,{subtree:true,childList:true});
    window.addEventListener('resize',()=>{
      for(const host of document.querySelectorAll('.company-hub-inline-audio-post[data-company-inline-audio-player]')){
        const canvas=host.querySelector('[data-company-audio-waveform]'),audio=host.querySelector('[data-company-audio-element]');
        if(canvas&&audio)companyHubDrawWaveform54(canvas,[],Number(audio.duration)>0?Number(audio.currentTime||0)/Number(audio.duration):0);
      }
    });
    renderCompanyHubFeedControls55();
  }
  /* Assurance Regent v6.3.55 — compact composer, inline audio playback and post menus END */
