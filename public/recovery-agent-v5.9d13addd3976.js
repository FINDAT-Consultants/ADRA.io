/* Assurance Regent Jivan v6.3.11 — connected Zari reception handoff + Jivan operator */
(() => {
  'use strict';
  const VOICE_PREF='assurance-regent-recovery-agent-voice-v5';
  const MIC_GRANTED_PREF='assurance-regent-jivan-microphone-granted-v1';
  const VOICE_CONVERSATION_PREF='assurance-regent-jivan-continuous-voice-enabled-v1';
  const QUICK_MIC_COLLAPSED_PREF='assurance-regent-jivan-quick-mic-collapsed-v1';
  const VOICE_END_SILENCE_MS=720;
  const LOCKED_VOICE_PREF='assurance-regent-jivan-human-voice-v1';
  const MAX_RECORDING_MS=60000;
  const MAX_AUDIO_BYTES=8*1024*1024;
  const $=(id)=>document.getElementById(id);
  let bridge=null, panel=null, launcher=null, launcherDock=null, quickMicBtn=null, quickMicToggle=null, messages=null, input=null, micBtn=null, voiceBtn=null, stopVoiceBtn=null, statusEl=null, contextEl=null, roleEl=null;
  let recorder=null, stream=null, microphoneSessionStream=null, chunks=[], stopTimer=null, sending=false, voiceEnabled=true, currentAudio=null, pausedByMute=false, pendingSpeech='';
  let audioContext=null, analyser=null, vadSource=null, vadFrame=0, vadData=null, silenceStartedAt=0, recordingStartedAt=0;
  let instantSpeechRun=0, currentUtterance=null, instantVoiceCache=null, userSpeechStopRun=0, jivanSpeaking=false,zariHandoffUntil=0,currentConnectedOperator='JIVAN';
  let conversationMode=false, conversationMonitoring=false, conversationTurnBusy=false, awaitingVoiceReply=false, conversationGeneration=0, conversationRestartTimer=null, conversationNoiseFloor=.006, conversationSpeechFrames=0, discardConversationTurn=false, lockedVoiceName='', conversationRemembered=false, microphonePriming=false;
  let lastHiddenAt=0, sessionStartedAt=Date.now(), proactiveBusy=false, quickMicCollapsed=false;
  let threadSynced=false, threadLoading=false, lastUserId='';
  try{const saved=localStorage.getItem(VOICE_PREF);if(saved!==null)voiceEnabled=saved==='1';lockedVoiceName=localStorage.getItem(LOCKED_VOICE_PREF)||'';conversationRemembered=localStorage.getItem(VOICE_CONVERSATION_PREF)==='1';quickMicCollapsed=localStorage.getItem(QUICK_MIC_COLLAPSED_PREF)==='1';}catch{}

  const esc=(s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=(role,perms={})=>perms?.authorityLabel||perms?.label||(role==='Developer'?'Developer AI':role==='Administrator'?'Administrator AI':'Employee AI');
  const context=()=>bridge?.getContext?.()||{};
  const viewName=()=>context()?.title||'Assurance Regent';
  const onAgentPage=()=>context()?.view==='assistant';
  const agentBlockingControlOpen=()=>document.body.classList.contains('control-agent-hidden')||Boolean(document.querySelector('#controlDrawer:not([hidden]) [data-control-pane="profile"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="settings"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="reviews"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="notifications"]:not([hidden])'));

  function buildUi(){
    if($('recoveryAgentLauncher'))return;
    launcherDock=document.createElement('div');launcherDock.id='jivanOperatorDock';launcherDock.className='jivan-operator-dock';
    quickMicBtn=document.createElement('button');quickMicBtn.type='button';quickMicBtn.id='jivanQuickMic';quickMicBtn.className='jivan-quick-mic';quickMicBtn.setAttribute('aria-label','Start Jivan voice conversation');quickMicBtn.innerHTML='<span aria-hidden="true">🎙</span>';
    quickMicToggle=document.createElement('button');quickMicToggle.type='button';quickMicToggle.id='jivanQuickMicToggle';quickMicToggle.className='jivan-quick-mic-toggle';
    launcher=document.createElement('button');launcher.type='button';launcher.id='recoveryAgentLauncher';launcher.className='recovery-agent-launcher';launcher.setAttribute('aria-label','Open Jivan');launcher.innerHTML='<span class="agent-launcher-orb">✦</span><span class="agent-launcher-copy"><b>Jivan</b><small>AI operator</small></span>';
    const launcherWave=document.createElement('span');launcherWave.className='agent-launcher-wave';launcherWave.setAttribute('aria-hidden','true');launcherWave.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';launcher.appendChild(launcherWave);
    launcherDock.append(quickMicBtn,quickMicToggle,launcher);
    panel=document.createElement('aside');panel.id='recoveryAgentFloatingPanel';panel.className='recovery-agent-floating-panel';panel.hidden=true;panel.setAttribute('aria-label','Jivan interactive console');
    panel.innerHTML=`
      <header class="raf-head">
        <div class="raf-identity"><span class="raf-orb">✦</span><div><b>Jivan</b><small id="rafContext">Ready</small></div></div>
        <div class="raf-head-actions"><span class="raf-role" id="rafRole">AI</span><button type="button" class="raf-icon raf-clear" id="rafClear" title="Clear this Jivan conversation" aria-label="Clear Jivan conversation">Clear</button><button type="button" class="raf-icon raf-stop-voice" id="rafStopVoice" title="Stop Jivan speaking" aria-label="Stop Jivan speaking">■</button><button type="button" class="raf-icon" id="rafVoice" title="Mute spoken responses" aria-label="Mute or unmute spoken responses">🔊</button><button type="button" class="raf-icon" id="rafMinimize" title="Minimize Jivan" aria-label="Minimize Jivan">—</button><button type="button" class="raf-icon" id="rafClose" aria-label="Close Jivan">×</button></div>
      </header>
      <div class="raf-security" id="rafSecurity">Role guardrails active</div>
      <div class="raf-messages" id="rafMessages" aria-live="polite"><div class="raf-welcome"><b>Jivan is ready.</b><span>Start Voice once for a hands-free conversation, type an instruction, upload a file, or delegate permitted background work while you continue elsewhere.</span></div></div>
      <div class="raf-status" id="rafStatus">Waiting for your instruction.</div>
      <form class="raf-form" id="rafForm">
        <textarea id="rafInput" rows="2" placeholder="e.g. Open Payroll and wait for my next instruction" aria-label="Command Jivan"></textarea>
        <div class="raf-controls"><button type="button" class="raf-mic" id="rafMic" aria-label="Speak to Jivan" title="Start microphone recording">🎙 Mic</button><button type="button" class="raf-upload" id="rafUpload" aria-label="Upload a document to Jivan" title="Upload document">＋ File</button><button type="submit" class="raf-send">Send</button><input id="rafFileInput" type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,image/*" /></div>
      </form>`;
    document.body.append(launcherDock,panel);
    messages=$('rafMessages');input=$('rafInput');micBtn=$('rafMic');voiceBtn=$('rafVoice');stopVoiceBtn=$('rafStopVoice');statusEl=$('rafStatus');contextEl=$('rafContext');roleEl=$('rafRole');
    launcher.addEventListener('click',()=>setOpen(true,{operatorClick:true}));
    quickMicBtn?.addEventListener('click',()=>toggleVoiceConversation());
    quickMicToggle?.addEventListener('click',()=>setQuickMicCollapsed(!quickMicCollapsed));
    setQuickMicCollapsed(quickMicCollapsed,false);
    $('rafClose').addEventListener('click',()=>setOpen(false));
    $('rafMinimize')?.addEventListener('click',()=>setOpen(false));
    $('rafClear').addEventListener('click',()=>clearConversation(true));
    stopVoiceBtn?.addEventListener('click',()=>stopSpeakingNow());
    $('rafForm').addEventListener('submit',async e=>{e.preventDefault();await sendCurrent();});
    $('agentVoiceMain')?.addEventListener('click',()=>toggleVoice());
    $('agentMicMain')?.addEventListener('click',()=>toggleVoiceConversation());
    voiceBtn.addEventListener('click',()=>toggleVoice());
    micBtn.addEventListener('click',()=>toggleVoiceConversation());
    $('rafUpload')?.addEventListener('click',()=>$('rafFileInput')?.click());
    $('rafFileInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||!bridge?.analyzeUpload)return;setOpen(true);setStatus(`Analyzing ${file.name}…`,true);try{await bridge.analyzeUpload(file);setStatus(`${file.name} analyzed. Ask me what to do with the extracted information.`);}catch(err){setStatus(err?.message||'Could not analyze that document.');}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('rafForm').requestSubmit();}});
    updateVoiceButton();updateConversationUi();refreshIdentity();
  }

  function resetFloatingMessages(){
    if(!messages)return;
    messages.innerHTML=currentConnectedOperator==='ZARI'?'<div class="raf-welcome"><b>Zari is here.</b><span>Your reception agent is connected to Jivan and shares the same governed system context. Say “Jivan” whenever you want to hand the conversation back.</span></div>':'<div class="raf-welcome"><b>Jivan is ready.</b><span>Start Voice once for a hands-free conversation, type an instruction, upload a file, or delegate permitted background work while you continue elsewhere.</span></div>';
  }

  async function syncThread(){
    if(!bridge?.loadThread||threadLoading||threadSynced)return;
    threadLoading=true;
    try{await bridge.loadThread();threadSynced=true;}catch(err){console.warn('Jivan conversation sync unavailable:',err);}finally{threadLoading=false;}
  }

  function setQuickMicCollapsed(collapsed,persist=true){
    quickMicCollapsed=Boolean(collapsed);launcherDock?.classList.toggle('mic-collapsed',quickMicCollapsed);
    if(quickMicToggle){quickMicToggle.textContent=quickMicCollapsed?'‹':'›';quickMicToggle.title=quickMicCollapsed?'Show Jivan microphone':'Retract Jivan microphone';quickMicToggle.setAttribute('aria-label',quickMicToggle.title);quickMicToggle.setAttribute('aria-expanded',quickMicCollapsed?'false':'true');}
    if(persist){try{localStorage.setItem(QUICK_MIC_COLLAPSED_PREF,quickMicCollapsed?'1':'0');}catch{}}
  }
  function updateQuickMicUi(){
    if(!quickMicBtn)return;const active=Boolean(conversationMode),capturing=Boolean(recorder?.state==='recording'),listening=Boolean(active&&!jivanSpeaking&&!conversationTurnBusy&&!awaitingVoiceReply);
    quickMicBtn.classList.toggle('active',active);quickMicBtn.classList.toggle('recording',capturing);quickMicBtn.classList.toggle('listening',listening);quickMicBtn.classList.toggle('busy',Boolean(active&&(conversationTurnBusy||awaitingVoiceReply)));
    quickMicBtn.setAttribute('aria-pressed',active?'true':'false');quickMicBtn.setAttribute('aria-label',active?'End Jivan voice conversation':'Start Jivan voice conversation');quickMicBtn.title=active?(capturing?'Listening — pause to send':'Jivan microphone is active'):'Start Jivan voice conversation';
    launcherDock?.classList.toggle('jivan-speaking',jivanSpeaking);
  }

  function refreshVisibility(){
    if(!launcher||!panel||!bridge)return;
    const signed=Boolean(bridge.getUser?.());
    const hiddenForAgentPage=onAgentPage(), hiddenForControlCenter=agentBlockingControlOpen();
    const hideDock=!signed||hiddenForAgentPage||hiddenForControlCenter;launcher.hidden=hideDock;if(launcherDock)launcherDock.hidden=hideDock;
    if(hideDock){panel.hidden=true;launcher.classList.remove('panel-open');}
  }

  function setOpen(open,{operatorClick=false}={}){
    if(!panel||!launcher)return false;
    // The floating operator may only transition from closed to open after its own explicit launcher click.
    // Voice/microphone permission, quick-mic activation, uploads and background events must never open it implicitly.
    if(open&&panel.hidden&&!operatorClick)return false;
    if(onAgentPage()||agentBlockingControlOpen()){panel.hidden=true;launcher.hidden=true;if(launcherDock)launcherDock.hidden=true;launcher.classList.remove('panel-open');if(onAgentPage())$('chatInput')?.focus();return false;}
    panel.hidden=!open;launcher.classList.toggle('panel-open',open);
    if(open){refreshIdentity();syncThread();setTimeout(()=>input?.focus(),50);}
    return true;
  }
  function setSpeakingUi(active){
    const speaking=Boolean(active&&voiceEnabled);jivanSpeaking=speaking;
    launcher?.classList.toggle('speaking',speaking);panel?.classList.toggle('speaking',speaking);launcherDock?.classList.toggle('jivan-speaking',speaking);
    if(launcher)launcher.setAttribute('aria-label',speaking?'Jivan is speaking':'Open Jivan');
    if(stopVoiceBtn){stopVoiceBtn.classList.toggle('active',speaking);stopVoiceBtn.setAttribute('aria-pressed',speaking?'true':'false');}
    updateQuickMicUi();
    if(speaking){window.JivanHoloController?.setState?.('speaking','Jivan voice output active.',96,{step:'VOICE OUTPUT',route:'JIVAN CORE'});pauseConversationMonitor(true);}else{if(conversationMode&&!conversationTurnBusy&&!awaitingVoiceReply){window.JivanHoloController?.setState?.('listening','Voice channel active. Awaiting your next turn.',6,{step:'VOICE CHANNEL',route:'AUDIO INPUT'});scheduleConversationListen(260);}else window.JivanHoloController?.setState?.('idle','Developer channel ready. Awaiting instruction.',0,{step:'IDLE CYCLE'});}
  }

  function stopSpeakingNow(){
    userSpeechStopRun++;pendingSpeech='';pausedByMute=false;
    try{if(currentAudio){currentAudio.pause();currentAudio.currentTime=0;}}catch{}currentAudio=null;
    try{window.speechSynthesis?.cancel?.();}catch{}
    instantSpeechRun++;currentUtterance=null;setSpeakingUi(false);
    if(conversationMode){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(180);setStatus('Jivan stopped speaking. Voice conversation is listening again.');}else setStatus(`Speech stopped. You can continue reading in ${viewName()}.`);
  }

  function setStatus(text,busy=false){if(statusEl){statusEl.textContent=text||'';statusEl.classList.toggle('busy',busy);}const main=$('agentAudioStatus');if(main&&onAgentPage())main.textContent=text||'';}

  function updateVoiceButton(){
    if(voiceBtn){voiceBtn.textContent=voiceEnabled?'🔊':'🔇';voiceBtn.classList.toggle('active',voiceEnabled);voiceBtn.title=voiceEnabled?'Mute spoken responses':'Unmute spoken responses';voiceBtn.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
    const main=$('agentVoiceMain');if(main){main.textContent=voiceEnabled?'Mute voice':'Unmute voice';main.title=voiceEnabled?'Mute Jivan spoken responses':'Unmute Jivan spoken responses';main.classList.toggle('active',voiceEnabled);main.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
  }

  function micPermissionPreviouslyGranted(){try{return localStorage.getItem(MIC_GRANTED_PREF)==='1';}catch{return false;}}
  function markMicPermissionGranted(){try{localStorage.setItem(MIC_GRANTED_PREF,'1');}catch{}}
  function rememberVoiceConversation(enabled){conversationRemembered=Boolean(enabled);try{localStorage.setItem(VOICE_CONVERSATION_PREF,conversationRemembered?'1':'0');}catch{}}
  async function primeRememberedMicrophone({resumeConversation=true,autoStartGranted=true}={}){
    if(microphonePriming||!bridge?.getUser?.()||!conversationSupported())return false;const permission=await microphonePermissionState();if(permission!=='granted')return false;microphonePriming=true;
    try{await acquireMicrophoneSession();parkMicrophoneSession();markMicPermissionGranted();const shouldResume=resumeConversation&&(conversationRemembered||autoStartGranted);setStatus(shouldResume?'Microphone permission remembered · Jivan voice channel is active.':'Microphone permission remembered by the browser · ready without another Jivan prompt.');if(shouldResume&&!conversationMode)await startVoiceConversation({remember:true,automatic:true});return true;}
    catch(err){console.warn('Jivan microphone ready check failed:',err);return false;}finally{microphonePriming=false;}
  }
  function conversationSupported(){return Boolean(navigator.mediaDevices?.getUserMedia&&typeof MediaRecorder!=='undefined'&&(window.AudioContext||window.webkitAudioContext));}
  function updateConversationUi(){
    const active=Boolean(conversationMode),capturing=Boolean(recorder?.state==='recording');
    if(micBtn){micBtn.classList.toggle('recording',capturing);micBtn.textContent=active?(capturing?'● Listening':'■ End voice'):'🎙 Voice';micBtn.title=active?'End hands-free voice conversation':'Start hands-free voice conversation';micBtn.setAttribute('aria-pressed',active?'true':'false');}
    updateQuickMicUi();
    const main=$('agentMicMain');if(main){main.classList.toggle('recording',capturing);main.textContent=active?(capturing?'● Listening':'■ End voice'):'🎙 Voice conversation';main.title=active?'End hands-free voice conversation':'Start hands-free voice conversation';main.setAttribute('aria-pressed',active?'true':'false');}
    if(active&&capturing)window.JivanHoloController?.setState?.('listening','Speech detected. Capturing developer voice turn.',12,{step:'VOICE CAPTURE',route:'AUDIO INPUT'});else if(active&&!jivanSpeaking&&!conversationTurnBusy&&!awaitingVoiceReply)window.JivanHoloController?.setState?.('listening','Voice channel active. Waiting for speech.',5,{step:'VOICE CHANNEL',route:'AUDIO INPUT'});
  }
  function conversationCanListen(){return Boolean(conversationMode&&bridge?.getUser?.()&&!document.hidden&&!jivanSpeaking&&!sending&&!conversationTurnBusy&&!awaitingVoiceReply);}
  function pauseConversationMonitor(park=true){
    clearTimeout(conversationRestartTimer);conversationRestartTimer=null;conversationMonitoring=false;conversationSpeechFrames=0;silenceStartedAt=0;
    if(vadFrame){cancelAnimationFrame(vadFrame);vadFrame=0;}try{vadSource?.disconnect?.();}catch{}vadSource=null;analyser=null;vadData=null;
    if(audioContext){try{audioContext.close?.();}catch{}audioContext=null;}if(park)parkMicrophoneSession();updateConversationUi();
  }
  function scheduleConversationListen(delay=180){clearTimeout(conversationRestartTimer);conversationRestartTimer=null;if(!conversationCanListen())return;conversationRestartTimer=setTimeout(()=>startConversationMonitor().catch(()=>{}),delay);}
  function beginConversationCapture(activeStream,now){
    if(!conversationCanListen()||recorder?.state==='recording')return false;const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported?.(x));chunks=[];recordingStartedAt=now||Date.now();silenceStartedAt=0;
    const rec=preferred?new MediaRecorder(activeStream,{mimeType:preferred}):new MediaRecorder(activeStream);recorder=rec;const generation=conversationGeneration;
    rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};rec.onstop=()=>finishConversationTurn(rec,generation).catch(err=>{conversationTurnBusy=false;awaitingVoiceReply=false;setStatus(err?.message||'Jivan could not process that voice turn.');scheduleConversationListen(350);});
    try{rec.start(160);updateConversationUi();window.JivanHoloController?.setState?.('listening','Speech detected. Capturing developer voice turn.',12,{step:'VOICE CAPTURE',route:'AUDIO INPUT'});setStatus('Listening to you… pause when you are finished.',true);return true;}catch{recorder=null;chunks=[];updateConversationUi();return false;}
  }
  function stopConversationCapture(reason='silence'){
    const rec=recorder;if(!rec||rec.state!=='recording')return;conversationTurnBusy=true;pauseConversationMonitor(false);try{rec.stop();}catch{}updateConversationUi();window.JivanHoloController?.setState?.('analyzing',reason==='silence'?'Voice turn closed. Transcribing and routing to Jivan core.':'Processing developer voice turn.',22,{step:'VOICE TRANSCRIPTION',route:'AUDIO → JIVAN'});setStatus(reason==='silence'?'You finished speaking. Sending directly to Jivan…':'Processing your voice turn…',true);
  }
  async function startConversationMonitor(){
    if(!conversationCanListen()||conversationMonitoring)return false;if(!conversationSupported()){setStatus('Hands-free voice conversation is not supported by this browser.');return false;}
    try{const activeStream=await acquireMicrophoneSession();if(!conversationCanListen()){parkMicrophoneSession();return false;}activeStream.getAudioTracks?.().forEach(t=>{if(t.readyState==='live')t.enabled=true;});
      const AudioCtx=window.AudioContext||window.webkitAudioContext;audioContext=new AudioCtx();try{await audioContext.resume?.();}catch{}analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.14;vadSource=audioContext.createMediaStreamSource(activeStream);vadSource.connect(analyser);vadData=new Uint8Array(analyser.fftSize);conversationMonitoring=true;conversationNoiseFloor=Math.max(.004,Math.min(conversationNoiseFloor,.018));conversationSpeechFrames=0;updateConversationUi();setStatus('Voice conversation active · listening for you to speak.');
      const generation=conversationGeneration;const tick=()=>{
        if(generation!==conversationGeneration||!conversationMonitoring||!conversationCanListen()||!analyser||!vadData){pauseConversationMonitor(true);return;}
        analyser.getByteTimeDomainData(vadData);let sum=0;for(let i=0;i<vadData.length;i++){const v=(vadData[i]-128)/128;sum+=v*v;}const rms=Math.sqrt(sum/vadData.length),now=Date.now();const threshold=Math.max(.016,conversationNoiseFloor*2.7);
        if(recorder?.state==='recording'){
          if(rms>Math.max(.012,conversationNoiseFloor*1.85)){silenceStartedAt=0;}
          else{if(!silenceStartedAt)silenceStartedAt=now;if(now-silenceStartedAt>VOICE_END_SILENCE_MS&&now-recordingStartedAt>500){stopConversationCapture('silence');return;}}
          if(now-recordingStartedAt>=MAX_RECORDING_MS){stopConversationCapture('timeout');return;}
        }else{
          if(rms<threshold){conversationNoiseFloor=(conversationNoiseFloor*.985)+(rms*.015);conversationSpeechFrames=0;}
          else{conversationSpeechFrames++;if(conversationSpeechFrames>=3){conversationSpeechFrames=0;beginConversationCapture(activeStream,now);}}
        }
        vadFrame=requestAnimationFrame(tick);
      };vadFrame=requestAnimationFrame(tick);return true;
    }catch(err){pauseConversationMonitor(true);setStatus(err?.name==='NotAllowedError'?'The browser has not granted microphone access to Assurance Regent. Allow this site once, then start Voice conversation again.':'Could not start Jivan voice conversation.');return false;}
  }
  async function startVoiceConversation({remember=true,automatic=false}={}){
    if(conversationMode)return true;if(!conversationSupported()){setStatus('Hands-free voice conversation is not supported by this browser.');return false;}
    const permission=await microphonePermissionState();if(permission==='denied'){setStatus('Microphone access is blocked in this browser. Set Microphone to Allow for Assurance Regent, then start Voice conversation again.');return false;}if(automatic&&permission!=='granted')return false;
    try{await acquireMicrophoneSession();if(remember)rememberVoiceConversation(true);conversationMode=true;conversationGeneration++;conversationTurnBusy=false;awaitingVoiceReply=false;discardConversationTurn=false;updateConversationUi();if(!automatic)setOpen(true);setStatus(automatic?'Voice conversation resumed using the browser’s remembered microphone permission.':'Voice conversation started. Speak naturally; Jivan will answer after you pause.');scheduleConversationListen(60);return true;}
    catch(err){conversationMode=false;releaseMicrophoneSession();updateConversationUi();setStatus(err?.name==='NotAllowedError'?'The browser has not granted microphone access to Assurance Regent. Choose an ongoing Allow option for this HTTPS site, then start Voice conversation again.':'Could not start Jivan voice conversation.');return false;}
  }
  function endVoiceConversation(message='Voice conversation ended.',{rememberChoice=false}={}){
    if(rememberChoice)rememberVoiceConversation(false);conversationMode=false;conversationGeneration++;conversationTurnBusy=false;awaitingVoiceReply=false;discardConversationTurn=true;clearTimeout(conversationRestartTimer);conversationRestartTimer=null;pauseConversationMonitor(false);if(recorder?.state==='recording'){try{recorder.stop();}catch{}}else{recorder=null;chunks=[];}releaseMicrophoneSession();updateConversationUi();setStatus(message);
  }
  async function toggleVoiceConversation(){if(conversationMode){endVoiceConversation('Voice conversation ended.',{rememberChoice:true});return;}await startVoiceConversation({remember:true,automatic:false});}
  function resumeConversationAfterReply(delay=220){if(!conversationMode)return;awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(delay);}
  async function toggleVoice(){
    voiceEnabled=!voiceEnabled;
    try{localStorage.setItem(VOICE_PREF,voiceEnabled?'1':'0');}catch{}
    if(!voiceEnabled){
      try{if(currentAudio){currentAudio.pause();currentAudio.currentTime=0;}}catch{}currentAudio=null;try{window.speechSynthesis?.cancel?.();}catch{}instantSpeechRun++;currentUtterance=null;pausedByMute=false;setSpeakingUi(false);if(conversationMode){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(180);}setStatus('Jivan voice muted. Voice conversation will continue with written responses.');
    }else{
      setStatus('Jivan voice unmuted.');
      if(conversationMode&&!jivanSpeaking)scheduleConversationListen(180);
    }
    updateVoiceButton();
  }

  function setFloatingOperatorIdentity(name='JIVAN'){
    currentConnectedOperator=String(name||'JIVAN').toUpperCase()==='ZARI'?'ZARI':'JIVAN';const label=currentConnectedOperator==='ZARI'?'Zari':'Jivan',sub=currentConnectedOperator==='ZARI'?'Reception · connected to Jivan':'AI operator';const launchName=launcher?.querySelector?.('.agent-launcher-copy b'),launchSub=launcher?.querySelector?.('.agent-launcher-copy small'),panelName=panel?.querySelector?.('.raf-identity b');if(launchName)launchName.textContent=label;if(launchSub)launchSub.textContent=sub;if(panelName)panelName.textContent=label;if(launcher)launcher.setAttribute('aria-label',`Open ${label}`);if(panel)panel.setAttribute('aria-label',`${label} interactive console`);const welcome=messages?.querySelector?.('.raf-welcome');if(welcome)welcome.innerHTML=currentConnectedOperator==='ZARI'?'<b>Zari is here.</b><span>Your reception agent is connected to Jivan and shares the same governed system context. Say “Jivan” whenever you want to hand the conversation back.</span>':'<b>Jivan is ready.</b><span>Start Voice once for a hands-free conversation, type an instruction, upload a file, or delegate permitted background work while you continue elsewhere.</span>';
  }

  function refreshIdentity(){
    if(!bridge)return;const user=bridge.getUser?.(),ctx=context(),signed=Boolean(user);
    if(!signed){if(panel)panel.hidden=true;endVoiceConversation('Voice conversation ended.');refreshVisibility();return;}
    const userId=String(user.id||user.email||user.name||'');if(lastUserId&&lastUserId!==userId){threadSynced=false;resetFloatingMessages();}lastUserId=userId;
    const perms=bridge?.getPermissions?.()||{};
    if(roleEl){roleEl.textContent=roleLabel(user.role,perms);roleEl.dataset.role=perms.authority||user.role||'Employee';}
    if(contextEl)contextEl.textContent=`${ctx?.title||'Assurance Regent'} · ${user.name||user.id||user.role}`;
    const security=$('rafSecurity');if(security){const a=String(perms.authority||'');security.textContent=a==='DEVELOPER'?'Developer scope · destructive/security changes still require guardrails':a==='CEO'?'CEO company-wide scope · Developer authority remains separate':a==='HR_MANAGER'?'HR scope · people, leave, recruiting and onboarding controls':a==='FINANCE_MANAGER'?'Finance scope · payroll, cost and finance-review controls':a==='PROJECT_MANAGER'?'Project scope · managed staff, time and project controls':a==='PROGRAMS_MANAGER'?'Programs scope · program portfolio and managed-project controls':a==='ADMINISTRATOR'||user.role==='Administrator'?'Company-scoped AI · no Developer or cross-company access':a==='HEAD_OF_DEPARTMENT'||a==='SUPERVISOR'?'Managed-team scope · no company-wide authority':'Personal/limited AI · private and administrative areas blocked';}
    setFloatingOperatorIdentity(currentConnectedOperator);refreshVisibility();updateVoiceButton();updateConversationUi();if(conversationMode)scheduleConversationListen(300);
  }

  function addFloatingMessage(role,text,label=''){
    if(!messages||!text)return;messages.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className=`raf-message ${role}`;row.innerHTML=`${label?`<small>${esc(label)}</small>`:''}<div>${esc(text).replace(/\n/g,'<br>')}</div>`;messages.appendChild(row);while(messages.children.length>80)messages.removeChild(messages.firstElementChild);messages.scrollTop=messages.scrollHeight;threadSynced=true;
  }

  async function clearConversation(startNew=true){
    if(!bridge?.clearConversation)return;if(sending)return;setStatus('Clearing Jivan conversation…',true);
    try{await bridge.clearConversation(Boolean(startNew));resetFloatingMessages();if(input)input.value='';threadSynced=true;setStatus('Fresh Jivan conversation ready.');}
    catch(err){setStatus(err?.message||'Could not clear the Jivan conversation.');}
  }

  async function sendCurrent(){
    const text=input?.value.trim();if(!text||sending||!bridge)return;
    if(bridge.isUploadInstruction?.(text)&&bridge.requestUpload){if(input)input.value='';addFloatingMessage('user',text,'Upload instruction');const opened=bridge.requestUpload(text,{source:'floating-agent',userActivation:true});setStatus(opened?.target==='profile_photo'?'Choose the profile image; Jivan will continue automatically.':opened?.target==='documents'?'Choose the document; it will submit automatically.':'Choose the file; Jivan will analyze it automatically.');return;}
    if(input)input.value='';setOpen(true);sending=true;setStatus(`Working in ${viewName()}…`,true);try{if(instructionNeedsLocation(text))await refreshDeviceLocation();await bridge.send(text,{source:'floating-agent',userActivation:true});}catch(err){setStatus(err?.message||'Jivan could not complete the request.');}finally{sending=false;if(!statusEl?.textContent||statusEl.classList.contains('busy'))setStatus(`Ready in ${viewName()}.`);}
  }

  async function microphonePermissionState(){
    try{if(navigator.permissions?.query){const p=await navigator.permissions.query({name:'microphone'});return p?.state||'unknown';}}catch{}
    return 'unknown';
  }
  function microphoneSessionReady(){
    const tracks=microphoneSessionStream?.getAudioTracks?.()||[];
    return tracks.some(t=>t.readyState==='live');
  }
  function parkMicrophoneSession(){
    try{microphoneSessionStream?.getAudioTracks?.().forEach(t=>{if(t.readyState==='live')t.enabled=false;});}catch{}
  }
  function releaseMicrophoneSession(){
    try{microphoneSessionStream?.getTracks?.().forEach(t=>t.stop());}catch{}
    microphoneSessionStream=null;stream=null;
  }
  async function acquireMicrophoneSession(){
    if(microphoneSessionReady()){
      microphoneSessionStream.getAudioTracks().forEach(t=>{if(t.readyState==='live')t.enabled=true;});
      return microphoneSessionStream;
    }
    const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    markMicPermissionGranted();microphoneSessionStream=acquired;
    acquired.getAudioTracks?.().forEach(t=>t.addEventListener('ended',()=>{if(!microphoneSessionReady())microphoneSessionStream=null;},{once:true}));
    return acquired;
  }

  async function geolocationPermissionState(){
    try{if(navigator.permissions?.query){const p=await navigator.permissions.query({name:'geolocation'});return p?.state||'unknown';}}catch{}
    return 'unknown';
  }
  async function refreshDeviceLocation(){
    if(!navigator.geolocation)return false;
    const permission=await geolocationPermissionState();
    if(permission!=='granted')return false;
    return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
      const c=pos?.coords;if(!c)return resolve(false);
      window.__AssuranceRegentLocationContext={source:'device',latitude:Number(Number(c.latitude).toFixed(3)),longitude:Number(Number(c.longitude).toFixed(3)),accuracy_m:Math.round(Number(c.accuracy||0)),updated_at:new Date().toISOString()};
      resolve(true);
    },()=>resolve(false),{enableHighAccuracy:false,maximumAge:5*60*1000,timeout:5000}));
  }
  function instructionNeedsLocation(text=''){return /\b(near me|nearby|current location|where i am|restaurant|food|lunch|dinner|breakfast|meal|order food|takeaway|delivery)\b/i.test(String(text||''));}

  async function finishConversationTurn(rec,generation){
    const mime=rec?.mimeType||chunks[0]?.type||'audio/webm',blob=new Blob(chunks,{type:mime});const shouldDiscard=discardConversationTurn||generation!==conversationGeneration||!conversationMode;recorder=null;chunks=[];parkMicrophoneSession();updateConversationUi();
    if(shouldDiscard){discardConversationTurn=false;conversationTurnBusy=false;awaitingVoiceReply=false;return;}if(!blob.size||blob.size<900){conversationTurnBusy=false;setStatus('Voice conversation active · listening for you to speak.');scheduleConversationListen(220);return;}if(blob.size>MAX_AUDIO_BYTES){conversationTurnBusy=false;setStatus('That voice turn was too long. Please speak in shorter turns.');scheduleConversationListen(300);return;}
    setStatus('Understanding what you said…',true);try{const audioBase64=await blobToBase64(blob);const result=await bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime});const transcript=String(result?.text||'').trim();if(!transcript){conversationTurnBusy=false;setStatus('I could not hear clear speech. Voice conversation is listening again.');scheduleConversationListen(260);return;}
      setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}” — Jivan is responding.`,true);awaitingVoiceReply=true;sending=true;if(instructionNeedsLocation(transcript))await refreshDeviceLocation();await bridge.send(transcript,{source:'voice-conversation',directVoiceSubmit:true,continuousConversation:true});
    }catch(err){awaitingVoiceReply=false;conversationTurnBusy=false;setStatus(err?.message||'Jivan could not complete that voice turn.');scheduleConversationListen(350);}finally{sending=false;if(conversationMode&&awaitingVoiceReply){setTimeout(()=>{if(conversationMode&&awaitingVoiceReply&&!jivanSpeaking){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(220);}},12000);}}
  }
  function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error||new Error('Could not read recorded audio.'));r.readAsDataURL(blob);});}

  const localClock=()=>{const d=new Date();return {iso:d.toISOString(),local:d.toLocaleString(),hour:d.getHours(),minute:d.getMinutes(),weekday:d.toLocaleDateString([],{weekday:'long'}),date:d.toLocaleDateString('en-CA')};};
  function proactiveKey(reason){const u=bridge?.getUser?.()||{},c=localClock();return `assurance-regent-agent-${reason}-${u.id||u.name||'user'}-${c.date}`;}
  function proactiveDone(reason){try{return sessionStorage.getItem(proactiveKey(reason))==='1';}catch{return false;}}
  function markProactive(reason){try{sessionStorage.setItem(proactiveKey(reason),'1');}catch{}}
  function greetingReason(){
    const d=new Date(),mins=d.getHours()*60+d.getMinutes();
    if(mins<690)return 'morning';
    if(mins<=870)return 'midday';
    if(mins<1020)return 'afternoon';
    return 'evening';
  }
  async function runProactive(reason,extra={}){
    if(proactiveBusy||!bridge?.getUser?.())return null;
    if(['morning','midday','afternoon','evening','lunch_return','end_day'].includes(reason)&&proactiveDone(reason))return null;
    proactiveBusy=true;
    try{
      const notes=bridge.getNotifications?.()||{count:0,items:[]},clock=localClock();
      const result=await bridge.invoke({mode:'proactive',reason,local_time:clock,notification_count:Number(extra.count??notes.count??0),notifications:(extra.items||notes.items||[]).slice(0,8)});
      const text=String(result?.output_text||result?.text||'').trim();if(!text)return null;
      if(['morning','midday','afternoon','evening','lunch_return','end_day'].includes(reason))markProactive(reason);
      bridge.showMessage?.(text,reason==='notifications'?'Jivan notification':'Jivan');
      setStatus(text.length>150?`${text.slice(0,147)}…`:text);
      await speak(text);
      return text;
    }catch(err){console.warn('Proactive Jivan message unavailable:',err);return null;}finally{proactiveBusy=false;}
  }
  function scheduleSessionGreeting(delay=650){setTimeout(()=>{if(Date.now()<zariHandoffUntil){scheduleSessionGreeting(Math.max(350,zariHandoffUntil-Date.now()+280));return;}if(bridge?.getUser?.())runProactive(greetingReason()).catch(()=>{});},Math.max(200,Number(delay||650)));}
  function checkEndOfDay(){
    if(!bridge?.getUser?.()||document.hidden||proactiveDone('end_day'))return;
    const d=new Date(),mins=d.getHours()*60+d.getMinutes(),started=new Date(sessionStartedAt),startedMins=started.getHours()*60+started.getMinutes();
    if(startedMins<990&&mins>=990&&mins<=1200)runProactive('end_day').catch(()=>{});
  }
  function retryPendingSpeech(){
    if(!pendingSpeech||!voiceEnabled)return;const text=pendingSpeech;pendingSpeech='';speak(text).catch(()=>{});
  }
  function addFloatingDownload(download){
    if(!messages||!download?.url)return;messages.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className='raf-message assistant';const preview=download.previewUrl?`<img src="${esc(download.previewUrl)}" alt="${esc(download.title||download.name||'Jivan visualization')}" />`:'';row.innerHTML=`<div class="raf-download">${preview}<b>${esc(download.name||'Generated file')}</b><br><a href="${esc(download.url)}" download="${esc(download.name||'assurance-regent-export')}">Download file</a></div>`;messages.appendChild(row);messages.scrollTop=messages.scrollHeight;
  }

  function availableInstantVoice(){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    if(instantVoiceCache&&voices.includes(instantVoiceCache))return instantVoiceCache;
    const english=voices.filter(v=>/^en([-_]|$)/i.test(v.lang||'')),pool=english.length?english:voices;
    let chosen=null;if(lockedVoiceName)chosen=pool.find(v=>v.name===lockedVoiceName)||voices.find(v=>v.name===lockedVoiceName)||null;
    chosen=chosen||pool.find(v=>/natural|neural|online/i.test(v.name||''))||pool.find(v=>/microsoft.*(?:aria|jenny|guy|ryan)|google.*english/i.test(v.name||''))||pool[0]||null;
    instantVoiceCache=chosen;if(chosen&&chosen.name!==lockedVoiceName){lockedVoiceName=chosen.name;try{localStorage.setItem(LOCKED_VOICE_PREF,lockedVoiceName);}catch{}}return instantVoiceCache;
  }
  async function waitForInstantVoice(timeoutMs=1000){
    let voice=availableInstantVoice();if(voice)return voice;if(!('speechSynthesis' in window))return null;
    await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);window.speechSynthesis?.removeEventListener?.('voiceschanged',finish);resolve();};const timer=setTimeout(finish,timeoutMs);window.speechSynthesis?.addEventListener?.('voiceschanged',finish,{once:true});});
    return availableInstantVoice();
  }
  function instantSpeechChunks(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return [];
    const sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[clean],out=[];
    for(const sentence0 of sentences){let sentence=sentence0.trim();while(sentence.length>135){let cut=sentence.lastIndexOf(' ',135);if(cut<72)cut=135;out.push(sentence.slice(0,cut).trim());sentence=sentence.slice(cut).trim();}if(sentence)out.push(sentence);}return out.slice(0,160);
  }
  function stopInstantSpeech(){instantSpeechRun++;currentUtterance=null;try{window.speechSynthesis?.cancel?.();}catch{}setSpeakingUi(false);}
  async function startInstantSpeech(text){
    if(!voiceEnabled||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return Promise.resolve(false);
    const pieces=instantSpeechChunks(text);if(!pieces.length)return Promise.resolve(false);const voice=await waitForInstantVoice();if(!voice)return false;
    currentAudio?.pause?.();currentAudio=null;stopInstantSpeech();pauseConversationMonitor(true);const run=instantSpeechRun;pausedByMute=false;
    return new Promise(resolve=>{
      let index=0,started=false,finished=false,retries=0,chunkTimer=null,attemptSerial=0;
      const clearChunkTimer=()=>{if(chunkTimer){clearTimeout(chunkTimer);chunkTimer=null;}};
      const heartbeat=setInterval(()=>{if(run!==instantSpeechRun||!voiceEnabled)return;try{if(window.speechSynthesis?.paused)window.speechSynthesis.resume();}catch{}},900);
      const settle=value=>{if(finished)return;finished=true;clearChunkTimer();clearInterval(heartbeat);currentUtterance=null;resolve(value);};
      const failOrContinue=serial=>{if(serial!==attemptSerial)return;attemptSerial++;clearChunkTimer();if(run!==instantSpeechRun||!voiceEnabled){setSpeakingUi(false);settle(false);return;}if(retries<2){retries++;setTimeout(()=>speakCurrent(),100);return;}retries=0;index++;setTimeout(()=>next(),60);};
      const speakCurrent=()=>{
        if(run!==instantSpeechRun||!voiceEnabled){setSpeakingUi(false);settle(false);return;}
        const piece=pieces[index];if(!piece){next();return;}
        const serial=++attemptSerial,utterance=new SpeechSynthesisUtterance(piece);currentUtterance=utterance;utterance.voice=voice;utterance.lang=voice.lang||'en-US';utterance.rate=.99;utterance.pitch=1;utterance.volume=1;
        utterance.onstart=()=>{if(serial!==attemptSerial||run!==instantSpeechRun)return;started=true;setSpeakingUi(true);setStatus('Jivan is speaking…');};
        utterance.onend=()=>{if(serial!==attemptSerial||run!==instantSpeechRun)return;attemptSerial++;clearChunkTimer();retries=0;index++;setTimeout(()=>next(),45);};
        utterance.onerror=()=>failOrContinue(serial);
        chunkTimer=setTimeout(()=>{if(serial!==attemptSerial||run!==instantSpeechRun)return;try{if(window.speechSynthesis?.paused)window.speechSynthesis.resume();}catch{};if(window.speechSynthesis?.speaking){try{window.speechSynthesis.cancel();}catch{}}failOrContinue(serial);},Math.max(9500,piece.length*105));
        try{window.speechSynthesis.speak(utterance);}catch{failOrContinue(serial);}
      };
      const next=()=>{
        if(run!==instantSpeechRun||!voiceEnabled){setSpeakingUi(false);settle(false);return;}
        if(index>=pieces.length){setSpeakingUi(false);if(started)setStatus(`Ready in ${viewName()}.`);settle(started);return;}
        speakCurrent();
      };
      next();
    });
  }
  if('speechSynthesis' in window){window.speechSynthesis.addEventListener?.('voiceschanged',()=>{instantVoiceCache=null;availableInstantVoice();});availableInstantVoice();}

  async function speak(text){
    if(!voiceEnabled||!text)return false;const clean=String(text).replace(/\s+/g,' ').trim();if(!clean)return false;const stopRun=userSpeechStopRun;
    try{const spoken=await startInstantSpeech(clean);if(stopRun!==userSpeechStopRun)return false;if(!spoken){setSpeakingUi(false);setStatus('The selected Jivan human voice is temporarily unavailable. I kept the written response instead of switching to a different robotic voice.');}return spoken;}
    catch(err){setSpeakingUi(false);console.warn('Jivan human voice unavailable:',err);if(err?.name==='NotAllowedError'||/play|gesture|autoplay/i.test(String(err?.message||''))){pendingSpeech=clean;setStatus('Jivan voice is ready and will speak after your next click or key press.');}else setStatus('Jivan voice could not speak this response. The written response remains available.');return false;}
  }

  window.JivanVoiceController={speak:(text)=>speak(text),stop:()=>stopSpeakingNow(),startConversation:()=>startVoiceConversation({remember:true,automatic:false}),endConversation:()=>endVoiceConversation('Voice conversation ended.',{rememberChoice:true}),minimize:()=>setOpen(false),clear:()=>clearConversation(true)};

  function attachBridge(){bridge=window.AssuranceRegentAgentBridge||null;if(!bridge)return false;buildUi();threadSynced=false;refreshIdentity();refreshDeviceLocation().catch(()=>{});bridge.startBackgroundTasks?.();if(bridge.getUser?.()){scheduleSessionGreeting();setTimeout(()=>primeRememberedMicrophone({resumeConversation:true}).catch(()=>{}),350);}return true;}

  window.addEventListener('assurance-regent-agent-ready',()=>attachBridge());
  window.addEventListener('assurance-regent-view-change',()=>{refreshIdentity();refreshVisibility();});
  window.addEventListener('assurance-regent-control-panel-change',e=>{const d=e.detail||{},blocked=new Set(['profile','settings','reviews','notifications']);if(d.open&&blocked.has(d.panel)){if(panel)panel.hidden=true;if(launcher){launcher.hidden=true;launcher.classList.remove('panel-open');}if(launcherDock)launcherDock.hidden=true;}else refreshVisibility();});
  window.addEventListener('assurance-regent-agent-thread-reset',()=>{resetFloatingMessages();if(input)input.value='';threadSynced=true;});
  window.addEventListener('assurance-regent-agent-minimize',()=>setOpen(false));
  window.addEventListener('assurance-regent-agent-upload-requested',e=>{const d=e.detail||{};if(d.userActivation)return;setOpen(true);messages?.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className='raf-message assistant';const label=d.wanted?`Choose ${d.wanted}`:'Choose file';row.innerHTML=`<small>Jivan upload</small><div>The browser needs one user action to choose a local file. <button type="button" class="btn micro primary">${esc(label)}</button></div>`;row.querySelector('button')?.addEventListener('click',()=>bridge?.openUploadTarget?.(d.target||'recovery_agent',d.wanted||'',{userActivation:true,source:'floating-upload-button'}));messages?.appendChild(row);if(messages)messages.scrollTop=messages.scrollHeight;});
  window.addEventListener('assurance-regent-agent-message',e=>{const d=e.detail||{};if(d.temporary)return;addFloatingMessage(d.role||'assistant',d.text||'',d.label||'');});
  window.addEventListener('assurance-regent-agent-response',e=>{const d=e.detail||{};refreshIdentity();const reply=d.response?.text,signingOut=(d.response?.ui_actions||[]).some(a=>a?.type==='sign_out');if(reply){setStatus(`Ready in ${viewName()}.`);const spoken=d.noSpeak||!voiceEnabled?Promise.resolve(false):Promise.resolve(speak(reply));if(conversationMode&&awaitingVoiceReply&&!signingOut)spoken.finally(()=>resumeConversationAfterReply(220));}else if(d.error){setStatus(d.error);if(conversationMode){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(300);}}});
  window.addEventListener('assurance-regent-agent-actions',e=>{const ok=(e.detail?.results||[]).filter(x=>x.ok);if(ok.length)setStatus(`Completed ${ok.length} interface action${ok.length===1?'':'s'}. Ready for your next instruction.`);refreshIdentity();});
  window.addEventListener('assurance-regent-ai-operator',e=>{const op=String(e.detail?.operator||'JIVAN').toUpperCase();setFloatingOperatorIdentity(op);if(op==='ZARI')setStatus('Zari is active · connected to Jivan.');else if(bridge?.getUser?.())setStatus(`Jivan is ready in ${viewName()}.`);});
  window.addEventListener('assurance-regent-agent-handoff',e=>{const d=e.detail||{};if(String(d.from||'').toUpperCase()==='ZARI'&&String(d.to||'').toUpperCase()==='JIVAN'){zariHandoffUntil=Date.now()+2200;setStatus('Zari completed reception. Over to Jivan…',true);setTimeout(()=>{if(bridge?.getUser?.())setStatus(`Jivan is ready in ${viewName()}.`);},2300);}});
  window.addEventListener('assurance-regent-session-ready',()=>{sessionStartedAt=Date.now();threadSynced=false;refreshIdentity();refreshDeviceLocation().catch(()=>{});scheduleSessionGreeting();setTimeout(()=>primeRememberedMicrophone({resumeConversation:true}).catch(()=>{}),250);});
  window.addEventListener('assurance-regent-session-ended',()=>{setFloatingOperatorIdentity('JIVAN');endVoiceConversation('Voice conversation ended.');stopSpeakingNow();});
  window.addEventListener('assurance-regent-notifications-change',e=>{const d=e.detail||{};if(Number(d.count||0)>Number(d.previous||0))runProactive('notifications',{count:d.count,items:d.items||[]}).catch(()=>{});});
  window.addEventListener('assurance-regent-workday-event',e=>{const d=e.detail||{},now=new Date(),mins=now.getHours()*60+now.getMinutes();if(d.type==='clock_out'&&mins>=930)runProactive('end_day').catch(()=>{});});
  window.addEventListener('assurance-regent-agent-download',e=>addFloatingDownload(e.detail||{}));
  window.addEventListener('assurance-regent-jivan-task-progress',e=>{const d=e.detail||{};if(d.status==='COMPLETED')setStatus(`Jivan completed a delegated task: ${d.task?.title||'background task'}.`);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lastHiddenAt=Date.now();pauseConversationMonitor(true);return;}if(conversationMode)scheduleConversationListen(300);const away=lastHiddenAt?Date.now()-lastHiddenAt:0,last=lastHiddenAt;lastHiddenAt=0;const d=new Date(),mins=d.getHours()*60+d.getMinutes();if(last&&away>=15*60*1000&&mins>=690&&mins<=870)runProactive('lunch_return').catch(()=>{});checkEndOfDay();});
  window.addEventListener('pointerdown',retryPendingSpeech,{passive:true});
  window.addEventListener('keydown',retryPendingSpeech);
  setInterval(checkEndOfDay,5*60*1000);
  window.addEventListener('storage',e=>{if(e.key===VOICE_PREF){voiceEnabled=e.newValue==='1';if(!voiceEnabled){try{window.speechSynthesis?.cancel?.();}catch{}setSpeakingUi(false);if(conversationMode){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(180);}}updateVoiceButton();}});
  window.addEventListener('pagehide',()=>{if(conversationMode)endVoiceConversation('Voice conversation paused until Assurance Regent is opened again.');else releaseMicrophoneSession();});

  if(!attachBridge()){let tries=0;const t=setInterval(()=>{tries++;if(attachBridge()||tries>80)clearInterval(t);},100);}
})();
