  /* Assurance Regent v6.3.80 — Jivan Live Google Meet Media assistant START */
  const MEET_MEDIA_AUDIO_SCOPE80='https://www.googleapis.com/auth/meetings.conference.media.audio.readonly';
  const MEET_MEDIA_SPACE_SCOPE80='https://www.googleapis.com/auth/meetings.space.read';
  let meetMediaStatus80=null,meetMediaStatusAt80=0,meetMediaBusy80=false,meetMediaBundle80=null;
  let liveMeetSession80={interviewId:'',state:'IDLE',spaceId:'',meetingCode:'',participants:0,audioTracks:0,error:''};

  function meetMediaRequest80(payload={}){return baseSupabaseFunction77('meet-media-connector',payload);}
  async function loadMeetMediaStatus80(force=false){
    if(meetMediaStatus80&&!force&&Date.now()-meetMediaStatusAt80<8000)return meetMediaStatus80;
    try{meetMediaStatus80=await meetMediaRequest80({action:'status'});}catch(err){meetMediaStatus80={ready:false,error:err?.message||String(err)};}
    meetMediaStatusAt80=Date.now();return meetMediaStatus80;
  }
  function ensureMeetMediaStyles80(){
    if($('meetMediaStyles80'))return;const s=document.createElement('style');s.id='meetMediaStyles80';
    s.textContent=`.meet-live80{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 13px;margin:0 0 12px;border:1px solid #d7e8ee;border-radius:14px;background:#f8fcfd}.meet-live80-copy{display:grid;gap:2px;min-width:0}.meet-live80-copy b{font-size:11px}.meet-live80-copy small{font-size:9px;color:#667f8b;line-height:1.45}.meet-live80-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.meet-live80-state{font-size:9px;font-weight:900;padding:5px 8px;border-radius:999px;background:#edf2f4;color:#5d7480}.meet-live80-state.joined{background:#e8f7ef;color:#17643c}.meet-live80-state.waiting{background:#fff6dd;color:#73580f}.meet-live80-state.error{background:#fff0f0;color:#9f3131}.api-connection79-card.live-media80{grid-column:1/-1}.api-media80-note{font-size:9px;line-height:1.5;color:#6c808a;padding:8px 9px;border-radius:10px;background:#f5f8f9}.recruit-row-actions [data-jivan-live-meet80]{white-space:nowrap}@media(max-width:720px){.meet-live80{align-items:flex-start;flex-direction:column}.meet-live80-actions{width:100%}.meet-live80-actions .btn{flex:1}}`;
    document.head.appendChild(s);
  }
  function meetMediaStateClass80(state=''){const s=String(state||'').toUpperCase();return s==='JOINED'?'joined':['WAITING','JOINING','SIGNALLED','CREATED'].includes(s)?'waiting':s==='ERROR'?'error':'';}
  function meetMediaStateText80(state=''){const s=String(state||'IDLE').toUpperCase();return ({IDLE:'Not running',CREATED:'Client ready',JOINING:'Joining',SIGNALLED:'Waiting for admission',WAITING:'Waiting for Meet consent',JOINED:'Connected & listening',DISCONNECTED:'Stopped',ERROR:'Connection error'})[s]||s;}

  const baseLoadApiConnections80=loadApiConnections79;
  loadApiConnections79=async function(force=false){const out=await baseLoadApiConnections80(force);if(apiConnectionsDeveloper79())await loadMeetMediaStatus80(force);return out;};
  const baseRenderApiConnections80=renderApiConnections79;
  renderApiConnections79=function(){
    baseRenderApiConnections80();ensureMeetMediaStyles80();if(!apiConnectionsDeveloper79())return;
    const grid=$('apiConnectionsGrid79');if(!grid||grid.querySelector('[data-api-meet-media-card80]'))return;const m=meetMediaStatus80||{},ready=Boolean(m.ready),connected=Boolean(m.connected);
    const card=document.createElement('article');card.className='api-connection79-card live-media80';card.dataset.apiMeetMediaCard80='1';
    card.innerHTML=`<div class="api-connection79-head"><div><b>Jivan Live Meet Assistant</b><small>Google Meet Media API · receive-only live interview audio and participant metadata.</small></div>${apiStateLabel79(ready,'Live Media ready','Developer setup required')}</div><div class="api-connection79-services"><div class="api-connection79-service"><span>Audio-only Media API scope</span><b>${m.media_scope?'Granted':'Not granted'}</b></div><div class="api-connection79-service"><span>Meeting metadata scope</span><b>${m.space_scope?'Granted':'Not granted'}</b></div><div class="api-connection79-service"><span>Connected Google principal</span><b>${m.email?esc(m.email):'—'}</b></div><div class="api-connection79-service"><span>Connection model</span><b>Developer-managed · shared feature</b></div></div><div class="api-connection79-actions"><button type="button" class="btn ${ready?'ghost':'primary'} small" data-api-meet-media-connect80>${ready?'Reconnect Live Meet':'Connect Live Meet'}</button>${connected?'<button type="button" class="btn ghost small" data-api-meet-media-disconnect80>Disconnect</button>':''}</div><div class="api-connection79-meta"><span>Restricted Google scope. Refresh tokens remain server-side; interview users receive only a short-lived access token after an authorized interview action.</span>${m.redirect_uri?`<code>${esc(m.redirect_uri)}</code>`:''}<div class="api-media80-note">Google currently requires Developer Preview eligibility for the Cloud project, OAuth principal and every conference participant. The connected Google principal must already be present in the active Meet before the Media API client can attach.</div></div>`;
    grid.appendChild(card);
  };

  function meetMediaPopupWait80(popup,timeoutMs=180000){
    return new Promise((resolve,reject)=>{let done=false,timer=null,poll=null;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);window.removeEventListener('message',onMessage);try{if(popup&&!popup.closed)popup.close();}catch{}fn(v);};const check=async()=>{const x=await loadMeetMediaStatus80(true);if(x?.ready)return finish(resolve,x);if(popup?.closed)return finish(reject,new Error('Google Live Meet authorization closed before the required Media API scopes were granted.'));};const onMessage=e=>{if(e.origin!==location.origin)return;const d=e.data||{};if(d.type==='assurance-regent-meet-media-connected')setTimeout(check,120);else if(d.type==='assurance-regent-meet-media-error')finish(reject,new Error(d.message||'Google Live Meet authorization was not completed.'));};window.addEventListener('message',onMessage);poll=setInterval(()=>check().catch(()=>{}),1800);timer=setTimeout(()=>finish(reject,new Error('Google Live Meet authorization timed out.')),timeoutMs);});
  }
  async function connectMeetMedia80(){
    if(!apiConnectionsDeveloper79())throw new Error('Developer authority is required to manage API connections.');if(meetMediaBusy80)return;meetMediaBusy80=true;const popup=gmailPopup77();if(!popup){meetMediaBusy80=false;throw new Error('Allow pop-ups for Assurance Regent so Google Live Meet can be authorized.');}
    try{const auth=await meetMediaRequest80({action:'authorize_url',return_to:location.href});if(!auth?.url)throw new Error('Google Live Meet authorization URL could not be prepared.');popup.location.href=auth.url;try{popup.focus();}catch{}await meetMediaPopupWait80(popup);await loadMeetMediaStatus80(true);renderApiConnections79();toast('Jivan Live Meet Assistant connected. Authorized interview users can now bring Jivan live.');}finally{meetMediaBusy80=false;}
  }
  async function disconnectMeetMedia80(){if(!apiConnectionsDeveloper79())throw new Error('Developer authority is required.');if(!confirm('Disconnect Jivan Live Meet Assistant for all users?'))return;await meetMediaRequest80({action:'disconnect'});meetMediaStatus80={ready:false,connected:false,management:true};meetMediaStatusAt80=Date.now();renderApiConnections79();toast('Jivan Live Meet Assistant disconnected.');}

  function liveMeetHost80(){const table=$('recruitInterviewsTable');if(!table)return null;let host=$('meetLiveAssistant80');if(!host){host=document.createElement('div');host.id='meetLiveAssistant80';table.before(host);}return host;}
  function renderLiveMeetStatus80(){
    ensureMeetMediaStyles80();const host=liveMeetHost80();if(!host||!recruitmentHrAllowed())return;const service=meetMediaStatus80||{},state=liveMeetSession80.state||'IDLE',active=Boolean(liveMeetSession80.interviewId&&['CREATED','JOINING','SIGNALLED','WAITING','JOINED'].includes(state));
    host.className='meet-live80';host.innerHTML=`<div class="meet-live80-copy"><b>Jivan Live Meet Assistant</b><small>${service.ready?'Live Media service is available. Start the Google Meet first, then use Bring Jivan live on the interview row.':'Live Media is not available yet. The Developer manages this connection in Settings.'}${active?` · ${liveMeetSession80.participants} participant metadata · ${liveMeetSession80.audioTracks} live audio stream${liveMeetSession80.audioTracks===1?'':'s'}.`:''}</small></div><div class="meet-live80-actions"><span class="meet-live80-state ${meetMediaStateClass80(state)}">${esc(meetMediaStateText80(state))}</span>${active?'<button type="button" class="btn micro ghost" data-jivan-live-stop80>Stop Jivan live</button>':''}</div>`;
    document.querySelectorAll('#recruitInterviewsTable [data-interview-action="room"]').forEach(room=>{const cell=room.closest('.recruit-row-actions');if(!cell)return;const id=String(room.dataset.interviewId||''),existing=cell.querySelector('[data-jivan-live-meet80]');if(existing){existing.textContent=liveMeetSession80.interviewId===id&&active?'Jivan live':'Bring Jivan live';existing.disabled=Boolean(active&&liveMeetSession80.interviewId!==id);return;}const b=document.createElement('button');b.type='button';b.className='btn micro secondary';b.dataset.jivanLiveMeet80=id;b.textContent='Bring Jivan live';const notes=cell.querySelector('[data-jivan-interview-notes78]');(notes||room).insertAdjacentElement('afterend',b);});
  }
  const baseRenderMeetInterviewAssistant80=renderMeetInterviewAssistant78;
  renderMeetInterviewAssistant78=async function(){await baseRenderMeetInterviewAssistant80();await loadMeetMediaStatus80(false);renderLiveMeetStatus80();};

  function loadMeetMediaBundle80(){
    if(window.AssuranceRegentMeetMedia)return Promise.resolve(window.AssuranceRegentMeetMedia);if(meetMediaBundle80)return meetMediaBundle80;
    meetMediaBundle80=new Promise((resolve,reject)=>{const existing=$('meetMediaClientBundle80');if(existing){existing.addEventListener('load',()=>resolve(window.AssuranceRegentMeetMedia),{once:true});existing.addEventListener('error',()=>reject(new Error('Live Meet Media browser client failed to load.')),{once:true});return;}const s=document.createElement('script');s.id='meetMediaClientBundle80';s.src='./meet-media-client.bundle.js?v=6.3.80';s.async=true;s.onload=()=>window.AssuranceRegentMeetMedia?resolve(window.AssuranceRegentMeetMedia):reject(new Error('Live Meet Media browser client did not initialize.'));s.onerror=()=>reject(new Error('Live Meet Media browser client failed to load.'));document.head.appendChild(s);});return meetMediaBundle80;
  }
  function liveMeetError80(err){
    const raw=String(err?.message||err||'Live Meet connection failed.');
    if(raw.includes('NO_ACTIVE_CONFERENCE'))return 'The Google account connected by the Developer must already be inside this active Meet room before Jivan can attach. Join that Google account to the meeting, then try again.';
    if(raw.includes('CONSENTER_ABSENT'))return 'Google could not find an eligible person in the meeting to approve Live Meet access. The meeting initiator/eligible host must be present.';
    if(raw.includes('CONNECTIONS_EXHAUSTED'))return 'Another Meet Media client is already attached to this conference. Stop it or wait about 30 seconds before retrying.';
    if(raw.includes('DISABLED_BY_ADMIN'))return 'The Google Workspace administrator has disabled Meet Media API for this meeting organization.';
    if(raw.includes('DISABLED_BY_HOST_CONTROL'))return 'The meeting host has disabled Meet Media API for this call.';
    if(raw.includes('DISABLED_DUE_TO_WATERMARKING'))return 'Google Meet Media API cannot attach while meeting watermarking is enabled.';
    if(raw.includes('DISABLED_DUE_TO_ENCRYPTION'))return 'Google Meet Media API cannot attach to this encrypted meeting.';
    if(raw.includes('INCOMPATIBLE_DEVICE')||raw.includes('UNSUPPORTED_PLATFORM_PRESENT'))return 'One or more meeting participants/devices is not eligible for Google Meet Media API.';
    if(raw.includes('PERMISSION_DENIED')||raw.includes('insufficient')||raw.includes('Developer Preview'))return 'Google has not granted the required Meet Media Developer Preview/restricted-scope access. The Developer must complete Google eligibility and reconnect Live Meet.';
    if(raw.includes('MEET_MEDIA_NOT_CONNECTED')||raw.includes('Contact the Developer'))return 'Jivan Live Meet Assistant is not connected. Contact the Developer.';
    return raw.length>420?raw.slice(0,420)+'…':raw;
  }
  function setLiveMeetState80(state,extra={}){liveMeetSession80={...liveMeetSession80,...extra,state:String(state||'IDLE').toUpperCase()};renderLiveMeetStatus80();}
  async function startLiveJivan80(interviewId){
    const id=String(interviewId||'');if(!id||meetMediaBusy80)return;if(liveMeetSession80.interviewId&&liveMeetSession80.interviewId!==id&&['CREATED','JOINING','SIGNALLED','WAITING','JOINED'].includes(liveMeetSession80.state))return toast('Stop the current Jivan Live session before joining another interview.');
    meetMediaBusy80=true;setLiveMeetState80('JOINING',{interviewId:id,error:'',participants:0,audioTracks:0});
    try{
      if(!window.isSecureContext)throw new Error('Jivan Live Meet requires HTTPS.');if(typeof RTCPeerConnection==='undefined')throw new Error('This browser does not support the WebRTC features required for Live Meet.');
      const session=await meetMediaRequest80({action:'session',interview_id:id});if(!session?.access_token||!session?.meeting_space_id)throw new Error('Live Meet session credentials were not returned.');
      const bridge=await loadMeetMediaBundle80();bridge.createAudioClient({meetingSpaceId:String(session.meeting_space_id),accessToken:String(session.access_token)});setLiveMeetState80('CREATED',{spaceId:String(session.meeting_space_id),meetingCode:String(session.meeting_code||'')});await bridge.joinMeeting();setLiveMeetState80('SIGNALLED');toast('Jivan has requested Live Meet access. Watch Google Meet for the consent/start dialog.');
    }catch(err){const message=liveMeetError80(err);setLiveMeetState80('ERROR',{error:message});toast(message);}
    finally{meetMediaBusy80=false;}
  }
  async function stopLiveJivan80(){try{await window.AssuranceRegentMeetMedia?.leaveMeeting?.();}catch{}liveMeetSession80={interviewId:'',state:'DISCONNECTED',spaceId:'',meetingCode:'',participants:0,audioTracks:0,error:''};renderLiveMeetStatus80();toast('Jivan Live Meet Assistant stopped.');}

  window.addEventListener('assurance-regent-meet-media-status',e=>{const d=e.detail||{},state=String(d.state||'').toUpperCase();if(!liveMeetSession80.interviewId)return;if(state==='JOINED'){setLiveMeetState80('JOINED');toast('Jivan Live Meet Assistant is connected and receiving authorized meeting audio.');}else if(state==='WAITING')setLiveMeetState80('WAITING');else if(state==='DISCONNECTED'&&liveMeetSession80.state!=='ERROR')setLiveMeetState80('DISCONNECTED');else if(['CREATED','JOINING','SIGNALLED'].includes(state))setLiveMeetState80(state);});
  window.addEventListener('assurance-regent-meet-media-participants',e=>{if(!liveMeetSession80.interviewId)return;liveMeetSession80.participants=Math.max(0,Number(e.detail?.count||0));renderLiveMeetStatus80();});
  window.addEventListener('assurance-regent-meet-media-tracks',e=>{if(!liveMeetSession80.interviewId)return;liveMeetSession80.audioTracks=Math.max(0,Number(e.detail?.audioTracks||0));renderLiveMeetStatus80();});
  window.addEventListener('assurance-regent-meet-media-error',e=>{if(!liveMeetSession80.interviewId)return;const message=liveMeetError80(e.detail?.message||e.detail?.code||'Live Meet connection failed.');setLiveMeetState80('ERROR',{error:message});toast(message);});
  window.addEventListener('beforeunload',()=>{try{window.AssuranceRegentMeetMedia?.leaveMeeting?.();}catch{}});
  document.addEventListener('click',e=>{const connect=e.target.closest('[data-api-meet-media-connect80]'),disconnect=e.target.closest('[data-api-meet-media-disconnect80]'),start=e.target.closest('[data-jivan-live-meet80]'),stop=e.target.closest('[data-jivan-live-stop80]');if(connect){e.preventDefault();connectMeetMedia80().catch(err=>toast(err.message||String(err)));}else if(disconnect){e.preventDefault();disconnectMeetMedia80().catch(err=>toast(err.message||String(err)));}else if(start){e.preventDefault();startLiveJivan80(start.dataset.jivanLiveMeet80||'');}else if(stop){e.preventDefault();stopLiveJivan80();}});
  /* Assurance Regent v6.3.80 — Jivan Live Google Meet Media assistant END */
