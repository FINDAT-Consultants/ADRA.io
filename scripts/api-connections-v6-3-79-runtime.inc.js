  /* Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START */
  const API_CONNECTIONS_PAGE79='api-connections';
  let apiConnectionsBusy79=false,apiConnectionsLoaded79=false,apiConnectionsStudio79=null;

  function apiConnectionsDeveloper79(){
    const u=controlUser?.();
    return String(u?.id||'')==='Dvp'||String(u?.role||'').toLowerCase()==='developer';
  }

  function apiConnectionsGenericUnavailable79(kind='service'){
    const label=String(kind||'service').toLowerCase()==='interview'?'Jivan interview notes':'Email service';
    return new Error(`${label} is currently unavailable. Contact the Developer.`);
  }

  function removeLegacyApiConnectionUi79(){
    $('gmailProfileConnection77')?.remove();
    document.querySelectorAll('[data-gmail-connection77]').forEach(x=>x.remove());
    document.querySelectorAll('[data-meet-connect78]').forEach(x=>x.remove());
    document.querySelectorAll('.studio-gmail77-meta').forEach(x=>x.remove());
  }

  function ensureApiConnectionsStyles79(){
    if($('apiConnectionsStyles79'))return;
    const s=document.createElement('style');s.id='apiConnectionsStyles79';
    s.textContent=`.api-connections79{display:grid;gap:14px}.api-connections79-summary{padding:12px 14px;border:1px solid #d9e6eb;border-radius:14px;background:#f8fbfc;font-size:11px;color:#526d7a}.api-connections79-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.api-connection79-card{border:1px solid #dce7ec;border-radius:16px;background:#fff;padding:14px;display:grid;gap:10px}.api-connection79-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.api-connection79-head div{display:grid;gap:3px}.api-connection79-head b{font-size:13px}.api-connection79-head small{font-size:10px;color:#68808c}.api-connection79-state{font-size:9px;font-weight:900;letter-spacing:.04em;padding:5px 8px;border-radius:999px;background:#eef3f5;color:#58707c}.api-connection79-state.ready{background:#e9f7ef;color:#17623c}.api-connection79-state.warn{background:#fff6df;color:#7b5b0d}.api-connection79-services{display:grid;gap:6px}.api-connection79-service{display:flex;justify-content:space-between;gap:10px;font-size:10px;padding:7px 0;border-top:1px solid #eef3f5}.api-connection79-service b{font-size:10px}.api-connection79-actions{display:flex;gap:8px;flex-wrap:wrap}.api-connection79-meta{font-size:9px;color:#718894;display:grid;gap:4px}.api-connection79-meta code{font-size:9px;white-space:normal;overflow-wrap:anywhere;background:#f4f7f8;padding:6px 7px;border-radius:8px}.api-connections79-footer{display:flex;justify-content:flex-end;gap:8px}@media(max-width:760px){.api-connections79-grid{grid-template-columns:1fr}.api-connection79-actions .btn{flex:1}}`;
    document.head.appendChild(s);
  }

  function ensureApiConnectionsSection79(){
    const pane=$('controlPaneSettings'),menu=$('settingsModalMenu'),form=$('controlSettingsForm');
    if(!pane||!menu||!form)return null;
    ensureApiConnectionsStyles79();
    SETTINGS_PAGE_META[API_CONNECTIONS_PAGE79]=['API connections','Developer-managed external service connections used across Assurance Regent.'];
    let nav=menu.querySelector(`[data-settings-nav="${API_CONNECTIONS_PAGE79}"]`);
    if(!nav){
      nav=document.createElement('button');nav.type='button';nav.dataset.settingsNav=API_CONNECTIONS_PAGE79;nav.innerHTML='<span>⇄</span>API connections';
      menu.appendChild(nav);
    }
    let section=$('settingsApiConnectionsSection79');
    if(!section){
      section=document.createElement('section');section.id='settingsApiConnectionsSection79';section.className='control-settings-section api-connections79';section.dataset.settingsPage=API_CONNECTIONS_PAGE79;section.hidden=true;
      section.innerHTML='<div class="settings-section-head"><div><b>API connections</b><small>Platform integrations are connected once by the Developer and then used by authorized users across the system.</small></div></div><div class="api-connections79-summary">Connection credentials and refresh tokens remain server-side. Administrators, HR users, employees and other roles use the enabled services without seeing API keys, OAuth controls, redirect URLs or provider setup errors.</div><div class="api-connections79-grid" id="apiConnectionsGrid79"></div><div class="api-connections79-footer"><button type="button" class="btn ghost small" data-api-connections-refresh79>Refresh status</button></div>';
      const actions=form.querySelector('.control-form-actions');if(actions)form.insertBefore(section,actions);else form.appendChild(section);
    }
    return section;
  }

  function syncApiConnectionsVisibility79(){
    ensureApiConnectionsSection79();
    const developer=apiConnectionsDeveloper79(),nav=document.querySelector(`[data-settings-nav="${API_CONNECTIONS_PAGE79}"]`),section=$('settingsApiConnectionsSection79');
    if(nav){nav.hidden=!developer;nav.dataset.permissionHidden=developer?'false':'true';}
    if(section){section.dataset.permissionHidden=developer?'false':'true';if(!developer)section.hidden=true;}
    if(!developer&&settingsActivePage===API_CONNECTIONS_PAGE79)showSettingsPage('general');
    removeLegacyApiConnectionUi79();
  }

  async function loadApiConnections79(force=false){
    if(!apiConnectionsDeveloper79())return null;
    if(apiConnectionsLoaded79&&!force)return {gmail:gmailStatus77,meet:meetAssistantStatus78,studio:apiConnectionsStudio79};
    const [gmail,meet,studio]=await Promise.all([
      loadGmailStatus77(force),
      loadMeetAssistantStatus78(force),
      baseSupabaseFunction77('recovery-agent',{mode:'studio_status'}).catch(()=>null)
    ]);
    apiConnectionsStudio79=studio||null;
    if(studio?.studio_connectors)state.jivanStudioConnectorStatus=studio.studio_connectors;
    apiConnectionsLoaded79=true;
    return {gmail,meet,studio};
  }

  function apiStateLabel79(ok,ready='Connected',missing='Not configured'){return `<span class="api-connection79-state ${ok?'ready':'warn'}">${ok?ready:missing}</span>`;}

  function renderApiConnections79(){
    syncApiConnectionsVisibility79();
    if(!apiConnectionsDeveloper79())return;
    const grid=$('apiConnectionsGrid79');if(!grid)return;
    const g=gmailStatus77||{},m=meetAssistantStatus78||{},studio=apiConnectionsStudio79||{},sc=studio?.studio_connectors||state.jivanStudioConnectorStatus||{};
    const googleReady=Boolean(g.connected),meetReady=Boolean(g.meet_scope||m.meet_scope),apiKeyReady=Boolean(m.api_key_configured),jivanReady=Boolean(m.jivan_configured??studio?.configured),waReady=Boolean(sc.whatsapp?.secretConfigured),voiceReady=Boolean(sc.voice?.secretConfigured);
    grid.innerHTML=`
      <article class="api-connection79-card">
        <div class="api-connection79-head"><div><b>Google Workspace</b><small>Shared platform OAuth connection for Gmail sending and Google Meet interview evidence.</small></div>${apiStateLabel79(googleReady&&meetReady,'Connected platform-wide','Needs Developer connection')}</div>
        <div class="api-connection79-services">
          <div class="api-connection79-service"><span>Gmail sending</span><b>${googleReady?'Ready for all authorized users':'Not connected'}</b></div>
          <div class="api-connection79-service"><span>Meet transcript access</span><b>${meetReady?'Ready for HR interview workflows':'Permission required'}</b></div>
          <div class="api-connection79-service"><span>Connected account</span><b>${g.email?esc(g.email):'—'}</b></div>
        </div>
        <div class="api-connection79-actions">
          <button type="button" class="btn ${googleReady&&meetReady?'ghost':'primary'} small" data-api-google-connect79>${googleReady&&meetReady?'Reconnect Google Workspace':'Connect Google Workspace'}</button>
          ${googleReady?'<button type="button" class="btn ghost small" data-api-google-disconnect79>Disconnect</button>':''}
        </div>
        <div class="api-connection79-meta"><span>Scope: platform-wide · one Developer connection serves all users.</span>${g.redirect_uri?`<code>${esc(g.redirect_uri)}</code>`:''}</div>
      </article>
      <article class="api-connection79-card">
        <div class="api-connection79-head"><div><b>Google Meet API</b><small>Server-side project key used with the authorized Workspace connection for conference records and transcripts.</small></div>${apiStateLabel79(apiKeyReady,'Server key ready','Server key missing')}</div>
        <div class="api-connection79-services"><div class="api-connection79-service"><span>Meet REST API key</span><b>${apiKeyReady?'Stored securely in Vault':'Developer attention required'}</b></div><div class="api-connection79-service"><span>OAuth transcript scope</span><b>${meetReady?'Granted':'Not granted'}</b></div></div>
        <div class="api-connection79-meta"><span>The API key itself is never displayed in the browser.</span></div>
      </article>
      <article class="api-connection79-card">
        <div class="api-connection79-head"><div><b>Jivan AI</b><small>Server AI connection used for interview notes and other Jivan reasoning workflows.</small></div>${apiStateLabel79(jivanReady,'Server connection ready','Server connection missing')}</div>
        <div class="api-connection79-services"><div class="api-connection79-service"><span>AI provider secret</span><b>${jivanReady?'Configured server-side':'Developer attention required'}</b></div></div>
        <div class="api-connection79-meta"><span>Provider secrets remain outside the client application.</span></div>
      </article>
      <article class="api-connection79-card">
        <div class="api-connection79-head"><div><b>Twilio communications</b><small>Server connectors used by Developer-enabled WhatsApp and voice communication policies.</small></div>${apiStateLabel79(waReady||voiceReady,(waReady&&voiceReady)?'Server connections ready':'Partially configured','Not configured')}</div>
        <div class="api-connection79-services"><div class="api-connection79-service"><span>WhatsApp</span><b>${waReady?'Server secret ready':'Not configured'}</b></div><div class="api-connection79-service"><span>Voice calls</span><b>${voiceReady?'Server secret ready':'Not configured'}</b></div></div>
        <div class="api-connection79-meta"><span>Connection status is visible only to the Developer.</span></div>
      </article>`;
  }

  async function connectPlatformGoogle79(){
    if(!apiConnectionsDeveloper79())throw new Error('Developer authority is required to manage API connections.');
    if(apiConnectionsBusy79)return;
    apiConnectionsBusy79=true;
    const popup=gmailPopup77();if(!popup){apiConnectionsBusy79=false;throw new Error('Allow pop-ups for Assurance Regent so Google Workspace can be connected.');}
    try{
      const auth=await gmailConnectorRequest77({action:'authorize_url'});if(!auth?.url)throw new Error('Google authorization URL could not be prepared.');
      popup.location.href=auth.url;try{popup.focus();}catch{}
      await meetWaitForScope78(popup);
      await Promise.all([loadGmailStatus77(true),loadMeetAssistantStatus78(true)]);
      apiConnectionsLoaded79=false;await loadApiConnections79(true);renderApiConnections79();
      toast('Google Workspace connected platform-wide. Authorized users now use this shared connection.');
    }finally{apiConnectionsBusy79=false;}
  }

  async function disconnectPlatformGoogle79(){
    if(!apiConnectionsDeveloper79())throw new Error('Developer authority is required to manage API connections.');
    if(!confirm('Disconnect the platform Google Workspace connection for all users?'))return;
    await gmailConnectorRequest77({action:'disconnect'});
    gmailStatus77={connected:false,shared:true,management:true,provider:'GMAIL',meet_scope:false,client_configured:true};
    gmailStatusLoadedAt77=Date.now();meetAssistantStatus78={connected:false,meet_scope:false,shared:true,management:true};apiConnectionsLoaded79=false;
    renderApiConnections79();toast('Platform Google Workspace connection disconnected.');
  }

  /* Remove user-level connection controls. API setup now lives only in Developer Settings. */
  renderGmailProfile77=function(){removeLegacyApiConnectionUi79();};
  renderGmailStudio77=function(){
    removeLegacyApiConnectionUi79();
    const card=$('studioEmailSecret')?.closest('.studio-connector-card');if(!card)return;
    card.querySelector('h3')&&(card.querySelector('h3').textContent='Gmail');
    const from=$('studioEmailFrom'),fromLabel=from?.closest('label');if(fromLabel)fromLabel.classList.add('studio-email-from-hidden77');
    if(from)from.value=String(gmailStatus77?.email||'');
    if($('studioEmailSecret'))$('studioEmailSecret').textContent='Managed in Settings → API connections';
  };
  renderGmailConnectionUi77=function(){removeLegacyApiConnectionUi79();renderGmailStudio77();};

  ensureGmailConnected77=async function(preopenedPopup=null){
    try{preopenedPopup?.close();}catch{}
    const status=await loadGmailStatus77(true);if(status?.connected)return status;
    throw apiConnectionsGenericUnavailable79('email');
  };

  ensureMeetScope78=async function(){
    const x=await loadMeetAssistantStatus78(true);if(x?.meet_scope)return x;
    throw apiConnectionsGenericUnavailable79('interview');
  };
  authorizeMeetScope78=async function(){
    if(!apiConnectionsDeveloper79())throw apiConnectionsGenericUnavailable79('interview');
    await connectPlatformGoogle79();return loadMeetAssistantStatus78(true);
  };

  renderMeetInterviewAssistant78=async function(){
    ensureMeetAssistantStyles78();
    const host=interviewAssistantHost78();if(!host||!recruitmentHrAllowed())return;
    const selected=String(state.recruitVacancy||'');
    host.className='meet-assistant78';
    host.innerHTML=`<div class="meet-assistant78-copy"><span class="meet-assistant78-mark">J</span><div><b>Jivan interview notes</b><small>Prepare structured post-interview evidence for HR and the panel.</small></div></div><div class="meet-assistant78-actions"><button type="button" class="btn micro ghost" data-meet-compare78 ${selected?'':'disabled title="Select one vacancy first"'}>Compare interview evidence</button></div>`;
    document.querySelectorAll('#recruitInterviewsTable [data-interview-action="room"]').forEach(room=>{const cell=room.closest('.recruit-row-actions');if(!cell||cell.querySelector('[data-jivan-interview-notes78]'))return;const id=room.dataset.interviewId||'';const b=document.createElement('button');b.type='button';b.className='btn micro secondary';b.dataset.jivanInterviewNotes78=id;b.textContent='Jivan notes';room.insertAdjacentElement('afterend',b);});
    removeLegacyApiConnectionUi79();
  };

  /* Bypass the old per-user OAuth popup interception for email sends. */
  const gmailWrappedSupabaseFunction79=supabaseFunction;
  supabaseFunction=async function(name,payload={}){
    if(name==='recruitment-public'&&String(payload?.action||'').toLowerCase()==='hr_send_outreach'&&String(payload?.channel||'').toLowerCase()==='email'){
      await ensureGmailConnected77();
      const app=(recruitmentBundle?.().applications||[]).find(x=>String(x.id||'')===String(payload.application_id||''));if(!app)throw new Error('Recruitment application not found.');
      return gmailConnectorRequest77({action:'send',source:'recruitment',to:String(app.email||''),subject:String(payload.subject||''),body:String(payload.message||''),metadata:{application_id:String(app.id||''),company_id:String(app.company_id||app.companyId||'')}});
    }
    if(name==='recovery-agent'&&String(payload?.mode||'').toLowerCase()==='communication_send'&&String(payload?.channel||'').toUpperCase()==='EMAIL'){
      await ensureGmailConnected77();
      return gmailConnectorRequest77({action:'send',source:'jivan',to:String(payload.to||''),subject:String(payload.subject||''),body:String(payload.body||'')});
    }
    return gmailWrappedSupabaseFunction79(name,payload);
  };

  const baseSyncSettingsModalPermissions79=syncSettingsModalPermissions;
  syncSettingsModalPermissions=function(){const r=baseSyncSettingsModalPermissions79();syncApiConnectionsVisibility79();return r;};

  const baseRenderSettingsPane79=renderSettingsPane;
  renderSettingsPane=function(){
    const r=baseRenderSettingsPane79();ensureApiConnectionsSection79();syncApiConnectionsVisibility79();
    if(apiConnectionsDeveloper79())loadApiConnections79(false).then(()=>renderApiConnections79()).catch(()=>renderApiConnections79());
    return r;
  };

  document.addEventListener('click',e=>{
    const connect=e.target.closest('[data-api-google-connect79]'),disconnect=e.target.closest('[data-api-google-disconnect79]'),refresh=e.target.closest('[data-api-connections-refresh79]');
    if(connect){e.preventDefault();connectPlatformGoogle79().catch(err=>toast(err.message||String(err)));}
    else if(disconnect){e.preventDefault();disconnectPlatformGoogle79().catch(err=>toast(err.message||String(err)));}
    else if(refresh){e.preventDefault();apiConnectionsLoaded79=false;loadApiConnections79(true).then(()=>{renderApiConnections79();toast('API connection status refreshed.');}).catch(err=>toast(err.message||String(err)));}
  });

  window.addEventListener('assurance-regent-session-ready',()=>{
    ensureApiConnectionsSection79();syncApiConnectionsVisibility79();
    if(apiConnectionsDeveloper79())loadApiConnections79(true).then(()=>renderApiConnections79()).catch(()=>renderApiConnections79());
  });

  setTimeout(()=>{ensureApiConnectionsSection79();syncApiConnectionsVisibility79();if(apiConnectionsDeveloper79())loadApiConnections79(false).then(()=>renderApiConnections79()).catch(()=>{});},0);
  /* Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing END */