  /* Assurance Regent v6.3.77 — Gmail OAuth outbound email integration START */
  const GMAIL_OAUTH_REDIRECT_URI77=`${SUPABASE_URL}/functions/v1/gmail-connector`;
  let gmailStatus77=null,gmailStatusLoadedAt77=0,gmailStatusPromise77=null,gmailConnectionPromise77=null;
  const baseSupabaseFunction77=supabaseFunction;
  function gmailReturnUrl77(){return `${location.origin}${location.pathname}`;}
  function gmailConnectorRequest77(payload={}){return baseSupabaseFunction77('gmail-connector',{...payload,return_to:payload.return_to||gmailReturnUrl77()});}
  async function loadGmailStatus77(force=false){
    if(!browserSessionToken)return {connected:false,email:'',client_configured:false,provider:'GMAIL'};
    if(!force&&gmailStatus77&&Date.now()-gmailStatusLoadedAt77<12000)return gmailStatus77;
    if(gmailStatusPromise77&&!force)return gmailStatusPromise77;
    gmailStatusPromise77=(async()=>{try{const x=await gmailConnectorRequest77({action:'status'});gmailStatus77=x||{connected:false};gmailStatusLoadedAt77=Date.now();return gmailStatus77;}catch(err){gmailStatus77={connected:false,email:'',client_configured:false,error:err?.message||String(err)};gmailStatusLoadedAt77=Date.now();return gmailStatus77;}finally{gmailStatusPromise77=null;}})();
    return gmailStatusPromise77;
  }
  function gmailPopup77(){try{return window.open('about:blank','assuranceRegentGmailOauth77','popup=yes,width=620,height=760,resizable=yes,scrollbars=yes');}catch{return null;}}
  function gmailWaitForConnection77(popup,timeoutMs=180000){
    return new Promise((resolve,reject)=>{let done=false,timer=null,poll=null;const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('message',onMessage);try{if(popup&&!popup.closed)popup.close();}catch{}fn(value);};const onMessage=e=>{if(e.origin!==location.origin)return;const data=e.data||{};if(data.type==='assurance-regent-gmail-connected'){loadGmailStatus77(true).then(x=>x.connected?finish(resolve,x):finish(reject,new Error('Gmail authorization completed, but the connection was not available.')));}else if(data.type==='assurance-regent-gmail-error')finish(reject,new Error(data.message||'Gmail authorization was not completed.'));};window.addEventListener('message',onMessage);timer=setTimeout(()=>finish(reject,new Error('Gmail authorization timed out. Try Connect Gmail again.')),timeoutMs);poll=setInterval(async()=>{try{const x=await loadGmailStatus77(true);if(x?.connected)finish(resolve,x);else if(popup&&popup.closed)finish(reject,new Error('Gmail authorization window was closed before the account was connected.'));}catch{}},1800);});
  }
  async function connectGmail77(options={}){
    if(gmailConnectionPromise77)return gmailConnectionPromise77;
    const popup=options.popup||gmailPopup77();
    gmailConnectionPromise77=(async()=>{try{
      const current=await loadGmailStatus77(true);if(current?.connected){try{popup?.close();}catch{}renderGmailConnectionUi77();return current;}
      const auth=await gmailConnectorRequest77({action:'authorize_url'});if(!auth?.url)throw new Error('Gmail authorization URL could not be prepared.');
      if(popup&&!popup.closed){popup.location.href=auth.url;try{popup.focus();}catch{}}
      else{const w=window.open(auth.url,'_blank','noopener,noreferrer');if(!w){await navigator.clipboard?.writeText?.(auth.url).catch(()=>{});throw new Error('Your browser blocked the Gmail authorization window. Allow pop-ups for Assurance Regent and try again.');}throw new Error('Complete Gmail authorization in the new tab, then retry the email action.');}
      const connected=await gmailWaitForConnection77(popup);gmailStatus77=connected;gmailStatusLoadedAt77=Date.now();renderGmailConnectionUi77();toast(`Gmail connected${connected.email?` as ${connected.email}`:''}.`);return connected;
    }finally{gmailConnectionPromise77=null;}})();
    return gmailConnectionPromise77;
  }
  async function ensureGmailConnected77(preopenedPopup=null){
    if(gmailStatus77?.connected&&Date.now()-gmailStatusLoadedAt77<12000){try{preopenedPopup?.close();}catch{}return gmailStatus77;}
    const popup=preopenedPopup||gmailPopup77(),status=await loadGmailStatus77();if(status?.connected){try{popup?.close();}catch{}return status;}return connectGmail77({popup});
  }
  async function disconnectGmail77(){if(!confirm('Disconnect the Gmail account used by Assurance Regent for sending email?'))return;await gmailConnectorRequest77({action:'disconnect'});gmailStatus77={connected:false,email:'',client_configured:true,provider:'GMAIL'};gmailStatusLoadedAt77=Date.now();renderGmailConnectionUi77();toast('Gmail disconnected.');}
  function gmailConnectionMarkup77(context='profile'){
    const x=gmailStatus77||{},connected=Boolean(x.connected),email=String(x.email||''),configured=x.client_configured!==false;
    return `<section class="gmail-connection77 ${connected?'connected':''}" data-gmail-connection77="${esc(context)}"><div class="gmail-connection77-copy"><span class="gmail-connection77-icon">M</span><div><b>Gmail sending</b><small>${connected?`Connected as ${esc(email)}`:configured?'Connect a Gmail account to send Assurance Regent emails.':'Gmail OAuth client configuration is not available yet.'}</small><code title="Google OAuth redirect URI">${esc(GMAIL_OAUTH_REDIRECT_URI77)}</code></div></div><div class="gmail-connection77-actions">${connected?'<button type="button" class="btn ghost small" data-gmail-disconnect77>Disconnect</button>':'<button type="button" class="btn primary small" data-gmail-connect77>Connect Gmail</button>'}</div></section>`;
  }
  function ensureGmailStyles77(){if($('gmailOauthStyles77'))return;const style=document.createElement('style');style.id='gmailOauthStyles77';style.textContent=`.gmail-connection77{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border:1px solid #d7e6ed;border-radius:16px;background:#fbfdfe;margin:14px 0}.gmail-connection77.connected{border-color:#b9decf;background:#f7fcf9}.gmail-connection77-copy{display:flex;align-items:center;gap:12px;min-width:0}.gmail-connection77-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:800;background:#fff;border:1px solid #dce8ee;color:#173d50}.gmail-connection77-copy div{display:grid;gap:3px;min-width:0}.gmail-connection77-copy b{font-size:13px}.gmail-connection77-copy small{font-size:11px;color:#617784}.gmail-connection77-copy code{font-size:9px;color:#78909b;max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gmail-connection77-actions{display:flex;gap:8px;flex:0 0 auto}.studio-gmail77-meta{display:grid;gap:4px;font-size:10px;color:#617784;margin-top:5px}.studio-gmail77-meta b{font-size:11px;color:#173d50}.studio-email-from-hidden77{display:none!important}@media(max-width:720px){.gmail-connection77{align-items:flex-start;flex-direction:column}.gmail-connection77-actions{width:100%}.gmail-connection77-actions .btn{width:100%}.gmail-connection77-copy code{max-width:74vw}}`;document.head.appendChild(style);}
  function renderGmailProfile77(){ensureGmailStyles77();const form=$('controlProfileForm');if(!form)return;let host=$('gmailProfileConnection77');if(!host){host=document.createElement('div');host.id='gmailProfileConnection77';const actions=form.querySelector('.profile-actions');if(actions)actions.before(host);else form.appendChild(host);}host.innerHTML=gmailConnectionMarkup77('profile');}
  function renderGmailStudio77(){ensureGmailStyles77();const card=$('studioEmailSecret')?.closest('.studio-connector-card');if(!card)return;card.querySelector('h3')&&(card.querySelector('h3').textContent='Gmail');const from=$('studioEmailFrom'),fromLabel=from?.closest('label');if(fromLabel)fromLabel.classList.add('studio-email-from-hidden77');let meta=card.querySelector('.studio-gmail77-meta');if(!meta){meta=document.createElement('div');meta.className='studio-gmail77-meta';card.querySelector('div:nth-child(2)')?.appendChild(meta);}const x=gmailStatus77||{};meta.innerHTML=x.connected?`<b>${esc(x.email||'Connected Gmail')}</b><span>OAuth connected · Gmail API sending</span><button type="button" class="btn micro ghost" data-gmail-disconnect77>Disconnect</button>`:`<span>Gmail is not connected for this user.</span><button type="button" class="btn micro primary" data-gmail-connect77>Connect Gmail</button>`;if(from)from.value=x.connected?String(x.email||''):'';if($('studioEmailSecret'))$('studioEmailSecret').textContent=x.connected?'Gmail account connected':x.client_configured===false?'Gmail OAuth configuration missing':'Gmail account not connected';
  }
  function renderGmailConnectionUi77(){renderGmailProfile77();renderGmailStudio77();}
  async function refreshGmailUi77(force=false){await loadGmailStatus77(force);renderGmailConnectionUi77();}
  function handleGmailOauthReturn77(){
    let u;try{u=new URL(location.href);}catch{return false;}const status=u.searchParams.get('gmail');if(!status)return false;const message=u.searchParams.get('gmail_message')||'';
    if(window.opener&&!window.opener.closed){try{window.opener.postMessage({type:status==='connected'?'assurance-regent-gmail-connected':'assurance-regent-gmail-error',message},location.origin);}catch{}setTimeout(()=>{try{window.close();}catch{}},80);return true;}
    u.searchParams.delete('gmail');u.searchParams.delete('gmail_message');try{history.replaceState({},'',u.pathname+u.search+u.hash);}catch{}setTimeout(()=>{refreshGmailUi77(true).then(()=>toast(status==='connected'?'Gmail connected.':message||'Gmail authorization was not completed.'));},300);return true;
  }
  document.addEventListener('click',e=>{const connect=e.target.closest('[data-gmail-connect77]'),disconnect=e.target.closest('[data-gmail-disconnect77]');if(connect){e.preventDefault();const popup=gmailPopup77();connectGmail77({popup}).catch(err=>toast(err.message||String(err)));}else if(disconnect){e.preventDefault();disconnectGmail77().catch(err=>toast(err.message||String(err)));}});

  supabaseFunction=async function(name,payload={}){
    if(name==='recruitment-public'&&String(payload?.action||'').toLowerCase()==='hr_send_outreach'&&String(payload?.channel||'').toLowerCase()==='email'){
      const popup=gmailStatus77?.connected?null:gmailPopup77();await ensureGmailConnected77(popup);const app=(recruitmentBundle?.().applications||[]).find(x=>String(x.id||'')===String(payload.application_id||''));if(!app)throw new Error('Recruitment application not found.');
      return gmailConnectorRequest77({action:'send',source:'recruitment',to:String(app.email||''),subject:String(payload.subject||''),body:String(payload.message||''),metadata:{application_id:String(app.id||''),company_id:String(app.company_id||app.companyId||'')}});
    }
    if(name==='recovery-agent'&&String(payload?.mode||'').toLowerCase()==='communication_send'&&String(payload?.channel||'').toUpperCase()==='EMAIL'){
      const popup=gmailStatus77?.connected?null:gmailPopup77();await ensureGmailConnected77(popup);return gmailConnectorRequest77({action:'send',source:'jivan',to:String(payload.to||''),subject:String(payload.subject||''),body:String(payload.body||'')});
    }
    const result=await baseSupabaseFunction77(name,payload);
    if(name==='recovery-agent'&&String(payload?.mode||'').toLowerCase()==='studio_status'){
      const g=await loadGmailStatus77(true);if(result?.studio_connectors&&g)result.studio_connectors.email={provider:'GMAIL',enabled:Boolean(result.studio_connectors.email?.enabled),secretConfigured:Boolean(g.client_configured),fromConfigured:Boolean(g.connected),connected:Boolean(g.connected),email:String(g.email||'')};
    }
    return result;
  };

  const baseRenderJivanStudio77=renderJivanStudio;
  renderJivanStudio=function(){const r=baseRenderJivanStudio77();renderGmailStudio77();return r;};
  const baseCollectJivanStudioConfig77=collectJivanStudioConfig;
  collectJivanStudioConfig=function(){const cfg=baseCollectJivanStudioConfig77(),connected=Boolean(gmailStatus77?.connected),email=String(gmailStatus77?.email||'');cfg.connectors=cfg.connectors||{};cfg.connectors.email={...(cfg.connectors.email||{}),provider:'GMAIL',enabled:Boolean($('studioEmailEnabled')?.checked),fromAddress:connected?email:'',secretAlias:'GMAIL_OAUTH'};return cfg;};
  const baseStudioConnectorConfigured77=studioConnectorConfigured;
  studioConnectorConfigured=function(channel){return String(channel||'').toLowerCase()==='email'?Boolean(gmailStatus77?.connected):baseStudioConnectorConfigured77(channel);};

  window.addEventListener('assurance-regent-session-ready',()=>refreshGmailUi77(true).catch(()=>{}));
  window.addEventListener('focus',()=>{if(browserSessionToken)refreshGmailUi77(false).catch(()=>{});});
  handleGmailOauthReturn77();
  setTimeout(()=>{renderGmailConnectionUi77();if(browserSessionToken)refreshGmailUi77(true).catch(()=>{});},0);
  /* Assurance Regent v6.3.77 — Gmail OAuth outbound email integration END */
