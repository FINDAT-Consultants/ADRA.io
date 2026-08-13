/* Assurance Regent Jivan v5.9.0 — named AI operator, delegated background tasks + direct voice submission */
(() => {
  'use strict';
  const VOICE_PREF='assurance-regent-recovery-agent-voice-v5';
  const MAX_RECORDING_MS=60000;
  const MAX_AUDIO_BYTES=8*1024*1024;
  const $=(id)=>document.getElementById(id);
  let bridge=null, panel=null, launcher=null, messages=null, input=null, micBtn=null, voiceBtn=null, stopVoiceBtn=null, taskBtn=null, statusEl=null, contextEl=null, roleEl=null;
  let recorder=null, stream=null, microphoneSessionStream=null, chunks=[], stopTimer=null, sending=false, voiceEnabled=true, currentAudio=null, pausedByMute=false, pendingSpeech='';
  let audioContext=null, analyser=null, vadSource=null, vadFrame=0, vadData=null, speechDetected=false, silenceStartedAt=0, recordingStartedAt=0;
  let instantSpeechRun=0, currentUtterance=null, instantVoiceCache=null, userSpeechStopRun=0;
  let lastHiddenAt=0, sessionStartedAt=Date.now(), proactiveBusy=false;
  let threadSynced=false, threadLoading=false, lastUserId='';
  try{const saved=localStorage.getItem(VOICE_PREF);if(saved!==null)voiceEnabled=saved==='1';}catch{}

  const esc=(s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=(role)=>role==='Developer'?'Developer AI':role==='Administrator'?'Administrator AI':'Employee AI';
  const context=()=>bridge?.getContext?.()||{};
  const viewName=()=>context()?.title||'Assurance Regent';
  const onAgentPage=()=>context()?.view==='assistant';
  const agentBlockingControlOpen=()=>document.body.classList.contains('control-agent-hidden')||Boolean(document.querySelector('#controlDrawer:not([hidden]) [data-control-pane="profile"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="settings"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="reviews"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane="notifications"]:not([hidden])'));

  function buildUi(){
    if($('recoveryAgentLauncher'))return;
    launcher=document.createElement('button');launcher.type='button';launcher.id='recoveryAgentLauncher';launcher.className='recovery-agent-launcher';launcher.setAttribute('aria-label','Open Jivan');launcher.innerHTML='<span class="agent-launcher-orb">✦</span><span class="agent-launcher-copy"><b>Jivan</b><small>AI operator</small></span>';
    const launcherWave=document.createElement('span');launcherWave.className='agent-launcher-wave';launcherWave.setAttribute('aria-hidden','true');launcherWave.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';launcher.appendChild(launcherWave);
    panel=document.createElement('aside');panel.id='recoveryAgentFloatingPanel';panel.className='recovery-agent-floating-panel';panel.hidden=true;panel.setAttribute('aria-label','Jivan interactive console');
    panel.innerHTML=`
      <header class="raf-head">
        <div class="raf-identity"><span class="raf-orb">✦</span><div><b>Jivan</b><small id="rafContext">Ready</small></div></div>
        <div class="raf-head-actions"><span class="raf-role" id="rafRole">AI</span><button type="button" class="raf-icon raf-task-badge" id="rafTasks" title="Open Jivan background tasks" aria-label="Open Jivan background tasks">0</button><button type="button" class="raf-icon raf-clear" id="rafClear" title="Clear this Jivan conversation" aria-label="Clear Jivan conversation">Clear</button><button type="button" class="raf-icon raf-stop-voice" id="rafStopVoice" title="Stop Jivan speaking" aria-label="Stop Jivan speaking">■</button><button type="button" class="raf-icon" id="rafVoice" title="Mute spoken responses" aria-label="Mute or unmute spoken responses">🔊</button><button type="button" class="raf-icon" id="rafClose" aria-label="Close Jivan">×</button></div>
      </header>
      <div class="raf-security" id="rafSecurity">Role guardrails active</div>
      <div class="raf-messages" id="rafMessages" aria-live="polite"><div class="raf-welcome"><b>Jivan is ready.</b><span>Call me “Jivan”, ask me to open a section, or delegate permitted background work while you continue elsewhere.</span></div></div>
      <div class="raf-status" id="rafStatus">Waiting for your instruction.</div>
      <form class="raf-form" id="rafForm">
        <textarea id="rafInput" rows="2" placeholder="e.g. Open Payroll and wait for my next instruction" aria-label="Command Jivan"></textarea>
        <div class="raf-controls"><button type="button" class="raf-mic" id="rafMic" aria-label="Speak to Jivan" title="Start microphone recording">🎙 Mic</button><button type="button" class="raf-upload" id="rafUpload" aria-label="Upload a document to Jivan" title="Upload document">＋ File</button><button type="submit" class="raf-send">Send</button><input id="rafFileInput" type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,image/*" /></div>
      </form>`;
    document.body.append(launcher,panel);
    messages=$('rafMessages');input=$('rafInput');micBtn=$('rafMic');voiceBtn=$('rafVoice');stopVoiceBtn=$('rafStopVoice');taskBtn=$('rafTasks');statusEl=$('rafStatus');contextEl=$('rafContext');roleEl=$('rafRole');
    launcher.addEventListener('click',()=>setOpen(true));
    $('rafClose').addEventListener('click',()=>setOpen(false));
    $('rafClear').addEventListener('click',()=>clearConversation());
    stopVoiceBtn?.addEventListener('click',()=>stopSpeakingNow());
    taskBtn?.addEventListener('click',()=>bridge?.openBackgroundTasks?.());
    $('rafForm').addEventListener('submit',async e=>{e.preventDefault();await sendCurrent();});
    $('agentVoiceMain')?.addEventListener('click',()=>toggleVoice());
    $('agentMicMain')?.addEventListener('click',()=>recorder?.state==='recording'?stopRecording():startRecording());
    voiceBtn.addEventListener('click',()=>toggleVoice());
    micBtn.addEventListener('click',()=>recorder?.state==='recording'?stopRecording():startRecording());
    $('rafUpload')?.addEventListener('click',()=>$('rafFileInput')?.click());
    $('rafFileInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||!bridge?.analyzeUpload)return;setOpen(true);setStatus(`Analyzing ${file.name}…`,true);try{await bridge.analyzeUpload(file);setStatus(`${file.name} analyzed. Ask me what to do with the extracted information.`);}catch(err){setStatus(err?.message||'Could not analyze that document.');}});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('rafForm').requestSubmit();}});
    updateVoiceButton();updateRecordingUi(false);refreshIdentity();
  }

  function resetFloatingMessages(){
    if(!messages)return;
    messages.innerHTML='<div class="raf-welcome"><b>Jivan is ready.</b><span>Call me “Jivan”, ask me to open a section, or delegate permitted background work while you continue elsewhere.</span></div>';
  }

  async function syncThread(){
    if(!bridge?.loadThread||threadLoading||threadSynced)return;
    threadLoading=true;
    try{await bridge.loadThread();threadSynced=true;}catch(err){console.warn('Jivan conversation sync unavailable:',err);}finally{threadLoading=false;}
  }

  function refreshVisibility(){
    if(!launcher||!panel||!bridge)return;
    const signed=Boolean(bridge.getUser?.());
    const hiddenForAgentPage=onAgentPage(), hiddenForControlCenter=agentBlockingControlOpen();
    launcher.hidden=!signed||hiddenForAgentPage||hiddenForControlCenter;
    if(!signed||hiddenForAgentPage||hiddenForControlCenter){panel.hidden=true;launcher.classList.remove('panel-open');}
  }

  function setOpen(open){
    if(!panel||!launcher)return;
    if(onAgentPage()||agentBlockingControlOpen()){panel.hidden=true;launcher.hidden=true;launcher.classList.remove('panel-open');if(onAgentPage())$('chatInput')?.focus();return;}
    panel.hidden=!open;launcher.classList.toggle('panel-open',open);
    if(open){refreshIdentity();syncThread();setTimeout(()=>input?.focus(),50);}
  }
  function setSpeakingUi(active){
    const speaking=Boolean(active&&voiceEnabled);
    launcher?.classList.toggle('speaking',speaking);panel?.classList.toggle('speaking',speaking);
    if(launcher)launcher.setAttribute('aria-label',speaking?'Jivan is speaking':'Open Jivan');
    if(stopVoiceBtn){stopVoiceBtn.classList.toggle('active',speaking);stopVoiceBtn.setAttribute('aria-pressed',speaking?'true':'false');}
  }

  function stopSpeakingNow(){
    userSpeechStopRun++;pendingSpeech='';pausedByMute=false;
    try{if(currentAudio){currentAudio.pause();currentAudio.currentTime=0;}}catch{}currentAudio=null;
    try{window.speechSynthesis?.cancel?.();}catch{}
    instantSpeechRun++;currentUtterance=null;setSpeakingUi(false);
    setStatus(`Speech stopped. You can continue reading in ${viewName()}.`);
  }

  function setStatus(text,busy=false){if(statusEl){statusEl.textContent=text||'';statusEl.classList.toggle('busy',busy);}const main=$('agentAudioStatus');if(main&&onAgentPage())main.textContent=text||'';}

  function updateVoiceButton(){
    if(voiceBtn){voiceBtn.textContent=voiceEnabled?'🔊':'🔇';voiceBtn.classList.toggle('active',voiceEnabled);voiceBtn.title=voiceEnabled?'Mute spoken responses':'Unmute spoken responses';voiceBtn.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
    const main=$('agentVoiceMain');if(main){main.textContent=voiceEnabled?'Mute voice':'Unmute voice';main.title=voiceEnabled?'Mute Jivan spoken responses':'Unmute Jivan spoken responses';main.classList.toggle('active',voiceEnabled);main.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
  }

  async function toggleVoice(){
    voiceEnabled=!voiceEnabled;
    try{localStorage.setItem(VOICE_PREF,voiceEnabled?'1':'0');}catch{}
    if(!voiceEnabled){
      if(currentAudio&&!currentAudio.ended&&!currentAudio.paused){currentAudio.pause();pausedByMute=true;}
      if(window.speechSynthesis?.speaking&&!window.speechSynthesis.paused){window.speechSynthesis.pause();pausedByMute=true;}
      setSpeakingUi(false);
      setStatus('Jivan voice muted.');
    }else{
      setStatus('Jivan voice unmuted.');
      if(window.speechSynthesis?.paused){try{window.speechSynthesis.resume();setSpeakingUi(true);pausedByMute=false;}catch{}}
      else if(pausedByMute&&currentAudio&&!currentAudio.ended){try{await currentAudio.play();setSpeakingUi(true);pausedByMute=false;}catch{setStatus('Voice is unmuted. Audio will resume with the next response.');}}
    }
    updateVoiceButton();
  }

  function updateRecordingUi(recording){
    if(micBtn){micBtn.classList.toggle('recording',recording);micBtn.textContent=recording?'■ Stop':'🎙 Mic';micBtn.title=recording?'Stop microphone recording':'Start microphone recording';micBtn.setAttribute('aria-pressed',recording?'true':'false');}
    const main=$('agentMicMain');if(main){main.classList.toggle('recording',recording);main.textContent=recording?'■ Stop recording':'🎙 Microphone';main.title=recording?'Stop microphone recording':'Start microphone recording';main.setAttribute('aria-pressed',recording?'true':'false');}
  }

  function refreshIdentity(){
    if(!bridge)return;const user=bridge.getUser?.(),ctx=context(),signed=Boolean(user);
    if(!signed){if(panel)panel.hidden=true;refreshVisibility();return;}
    const userId=String(user.id||user.email||user.name||'');if(lastUserId&&lastUserId!==userId){threadSynced=false;resetFloatingMessages();}lastUserId=userId;
    if(roleEl){roleEl.textContent=roleLabel(user.role);roleEl.dataset.role=user.role||'Employee';}
    if(contextEl)contextEl.textContent=`${ctx?.title||'Assurance Regent'} · ${user.name||user.id||user.role}`;
    const security=$('rafSecurity');if(security){security.textContent=user.role==='Developer'?'Developer scope · destructive/security changes still require guardrails':user.role==='Administrator'?'Company-scoped AI · no Developer or cross-company access':'Personal/limited AI · private and administrative areas blocked';}
    refreshVisibility();updateVoiceButton();updateRecordingUi(recorder?.state==='recording');
  }

  function addFloatingMessage(role,text,label=''){
    if(!messages||!text)return;messages.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className=`raf-message ${role}`;row.innerHTML=`${label?`<small>${esc(label)}</small>`:''}<div>${esc(text).replace(/\n/g,'<br>')}</div>`;messages.appendChild(row);while(messages.children.length>80)messages.removeChild(messages.firstElementChild);messages.scrollTop=messages.scrollHeight;threadSynced=true;
  }

  async function clearConversation(){
    if(!bridge?.clearConversation)return;
    if(sending)return;
    setStatus('Clearing Jivan conversation…',true);
    try{await bridge.clearConversation(false);resetFloatingMessages();threadSynced=true;setStatus('Conversation cleared everywhere.');}
    catch(err){setStatus(err?.message||'Could not clear the Jivan conversation.');}
  }

  async function sendCurrent(){const text=input?.value.trim();if(!text||sending||!bridge)return;if(input)input.value='';setOpen(true);sending=true;setStatus(`Working in ${viewName()}…`,true);try{if(instructionNeedsLocation(text))await refreshDeviceLocation();await bridge.send(text,{source:'floating-agent'});}catch(err){setStatus(err?.message||'Jivan could not complete the request.');}finally{sending=false;if(!statusEl?.textContent||statusEl.classList.contains('busy'))setStatus(`Ready in ${viewName()}.`);}}

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
    microphoneSessionStream=acquired;
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

  function stopVoiceActivityWatch(){
    if(vadFrame){cancelAnimationFrame(vadFrame);vadFrame=0;}
    try{vadSource?.disconnect?.();}catch{}vadSource=null;analyser=null;vadData=null;speechDetected=false;silenceStartedAt=0;recordingStartedAt=0;
    if(audioContext){try{audioContext.close?.();}catch{}audioContext=null;}
  }
  function startVoiceActivityWatch(activeStream){
    stopVoiceActivityWatch();
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;
    try{
      audioContext=new AudioCtx();analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.18;
      vadSource=audioContext.createMediaStreamSource(activeStream);vadSource.connect(analyser);vadData=new Uint8Array(analyser.fftSize);recordingStartedAt=Date.now();
      const tick=()=>{
        if(recorder?.state!=='recording'||!analyser||!vadData)return;
        analyser.getByteTimeDomainData(vadData);let sum=0;for(let i=0;i<vadData.length;i++){const v=(vadData[i]-128)/128;sum+=v*v;}const rms=Math.sqrt(sum/vadData.length);const now=Date.now();
        if(rms>.022){speechDetected=true;silenceStartedAt=0;}
        else if(speechDetected&&now-recordingStartedAt>850){if(!silenceStartedAt)silenceStartedAt=now;else if(now-silenceStartedAt>1450){stopRecording('silence');return;}}
        vadFrame=requestAnimationFrame(tick);
      };vadFrame=requestAnimationFrame(tick);
    }catch{stopVoiceActivityWatch();}
  }

  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setStatus('Microphone recording is not supported by this browser.');return;}
    if(recorder?.state==='recording')return;
    try{
      const permission=await microphonePermissionState();
      if(permission==='denied'){setStatus('Microphone access is blocked in this browser. Set Microphone to Allow for Assurance Regent, then click Mic again.');return;}
      stream=await acquireMicrophoneSession();
      const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported?.(x));recorder=preferred?new MediaRecorder(stream,{mimeType:preferred}):new MediaRecorder(stream);chunks=[];
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onstop=()=>finishRecording().catch(err=>setStatus(err?.message||'Could not process microphone audio.'));
      recorder.start(250);startVoiceActivityWatch(stream);updateRecordingUi(true);setStatus('Listening… press Stop, or pause briefly after speaking to send automatically.',true);stopTimer=setTimeout(()=>stopRecording('timeout'),MAX_RECORDING_MS);
    }catch(err){cleanupRecording();setStatus(err?.name==='NotAllowedError'?'The browser has not granted microphone access to Assurance Regent. Allow the site once in browser permissions; after that Mic starts directly for the session.':'Could not start the microphone.');}
  }
  function stopRecording(reason='manual'){if(recorder?.state==='recording')recorder.stop();clearTimeout(stopTimer);stopTimer=null;stopVoiceActivityWatch();updateRecordingUi(false);setStatus(reason==='silence'?'Finished speaking. Sending your voice command…':'Recording stopped. Processing your command…',true);}
  function cleanupRecording(){clearTimeout(stopTimer);stopTimer=null;stopVoiceActivityWatch();parkMicrophoneSession();stream=microphoneSessionStream;recorder=null;chunks=[];updateRecordingUi(false);}
  async function finishRecording(){
    const mime=recorder?.mimeType||chunks[0]?.type||'audio/webm';const blob=new Blob(chunks,{type:mime});stopVoiceActivityWatch();parkMicrophoneSession();stream=microphoneSessionStream;recorder=null;chunks=[];updateRecordingUi(false);
    if(!blob.size){setStatus('No microphone audio was captured.');return;}if(blob.size>MAX_AUDIO_BYTES){setStatus('That recording is too long. Please keep voice commands under about one minute.');return;}
    setStatus('Transcribing your voice command…',true);const audioBase64=await blobToBase64(blob);const result=await bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime});const transcript=String(result?.text||'').trim();if(!transcript){setStatus('I could not hear a clear command.');return;}
    setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}” — sending directly to Jivan.`,true);
    sending=true;try{if(instructionNeedsLocation(transcript))await refreshDeviceLocation();await bridge.send(transcript,{source:'voice-agent',directVoiceSubmit:true});}catch(err){setStatus(err?.message||'Jivan could not complete the voice command.');}finally{sending=false;}
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
  function scheduleSessionGreeting(){setTimeout(()=>{if(bridge?.getUser?.())runProactive(greetingReason()).catch(()=>{});},650);}
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

  function refreshTaskBadge(tasks){
    const rows=Array.isArray(tasks)?tasks:(bridge?.getBackgroundTasks?.()||[]),active=rows.filter(x=>['QUEUED','RUNNING','WAITING_USER'].includes(String(x?.status||''))).length;
    if(taskBtn){taskBtn.textContent=String(active);taskBtn.classList.toggle('active',active>0);taskBtn.title=active?`${active} active Jivan background task${active===1?'':'s'}`:'Open Jivan background tasks';}
  }

  function availableInstantVoice(){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    if(instantVoiceCache&&voices.includes(instantVoiceCache))return instantVoiceCache;
    const english=voices.filter(v=>/^en([-_]|$)/i.test(v.lang||''));const pool=english.length?english:voices;
    instantVoiceCache=pool.find(v=>/natural|online/i.test(v.name||''))||pool.find(v=>/microsoft|google/i.test(v.name||''))||pool[0]||null;return instantVoiceCache;
  }
  function instantSpeechChunks(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return [];
    const sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[clean],out=[];
    for(const sentence0 of sentences){let sentence=sentence0.trim();while(sentence.length>260){let cut=sentence.lastIndexOf(' ',260);if(cut<120)cut=260;out.push(sentence.slice(0,cut).trim());sentence=sentence.slice(cut).trim();}if(sentence)out.push(sentence);}return out.slice(0,24);
  }
  function stopInstantSpeech(){instantSpeechRun++;currentUtterance=null;try{window.speechSynthesis?.cancel?.();}catch{}setSpeakingUi(false);}
  function startInstantSpeech(text){
    if(!voiceEnabled||!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window))return Promise.resolve(false);
    const pieces=instantSpeechChunks(text);if(!pieces.length)return Promise.resolve(false);
    currentAudio?.pause?.();currentAudio=null;stopInstantSpeech();const run=instantSpeechRun;pausedByMute=false;
    return new Promise(resolve=>{
      let index=0,started=false,settled=false;const settle=value=>{if(settled)return;settled=true;clearTimeout(startTimer);resolve(value);};
      const startTimer=setTimeout(()=>{if(!started){if(run===instantSpeechRun){try{window.speechSynthesis.cancel();}catch{}setSpeakingUi(false);}settle(false);}},650);
      const next=()=>{
        if(run!==instantSpeechRun||!voiceEnabled){setSpeakingUi(false);settle(false);return;}
        if(index>=pieces.length){currentUtterance=null;setSpeakingUi(false);if(started)setStatus(`Ready in ${viewName()}.`);return;}
        const utterance=new SpeechSynthesisUtterance(pieces[index++]);currentUtterance=utterance;const voice=availableInstantVoice();if(voice)utterance.voice=voice;
        utterance.lang=voice?.lang||'en-US';utterance.rate=1.03;utterance.pitch=1;utterance.volume=1;
        utterance.onstart=()=>{if(run!==instantSpeechRun)return;started=true;settle(true);setSpeakingUi(true);setStatus('Speaking…');};
        utterance.onend=()=>{if(run===instantSpeechRun)next();};utterance.onerror=()=>{setSpeakingUi(false);if(!started)settle(false);};
        try{window.speechSynthesis.speak(utterance);}catch{setSpeakingUi(false);settle(false);}
      };next();
    });
  }
  if('speechSynthesis' in window){window.speechSynthesis.addEventListener?.('voiceschanged',()=>{instantVoiceCache=null;availableInstantVoice();});availableInstantVoice();}

  async function speak(text){
    if(!voiceEnabled||!bridge||!text)return;const clean=String(text).replace(/\s+/g,' ').trim().slice(0,1800);if(!clean)return;const stopRun=userSpeechStopRun;
    try{
      const instantStarted=await startInstantSpeech(clean);if(stopRun!==userSpeechStopRun)return;if(instantStarted)return;
      const result=await bridge.invoke({mode:'speech',text:clean});if(stopRun!==userSpeechStopRun)return;if(!result?.audio_base64){setSpeakingUi(false);return;}stopInstantSpeech();currentAudio?.pause?.();pausedByMute=false;
      const audio=new Audio(`data:${result.mime_type||'audio/mpeg'};base64,${result.audio_base64}`);currentAudio=audio;
      audio.addEventListener('play',()=>setSpeakingUi(true));audio.addEventListener('pause',()=>{if(!audio.ended)setSpeakingUi(false);});audio.addEventListener('ended',()=>{if(currentAudio===audio){currentAudio=null;pausedByMute=false;}setSpeakingUi(false);});await audio.play();
    }catch(err){setSpeakingUi(false);console.warn('Jivan voice unavailable:',err);if(err?.name==='NotAllowedError'||/play|gesture|autoplay/i.test(String(err?.message||''))){pendingSpeech=clean;setStatus('Voice is ready and will speak after your next click or key press.');}else setStatus('Spoken response could not play. Text response remains available.');}
  }

  function attachBridge(){bridge=window.AssuranceRegentAgentBridge||null;if(!bridge)return false;buildUi();threadSynced=false;refreshIdentity();refreshDeviceLocation().catch(()=>{});bridge.startBackgroundTasks?.();refreshTaskBadge(bridge.getBackgroundTasks?.()||[]);if(bridge.getUser?.())scheduleSessionGreeting();return true;}

  window.addEventListener('assurance-regent-agent-ready',()=>attachBridge());
  window.addEventListener('assurance-regent-view-change',()=>{refreshIdentity();refreshVisibility();});
  window.addEventListener('assurance-regent-control-panel-change',e=>{const d=e.detail||{},blocked=new Set(['profile','settings','reviews','notifications']);if(d.open&&blocked.has(d.panel)){if(panel)panel.hidden=true;if(launcher){launcher.hidden=true;launcher.classList.remove('panel-open');}}else refreshVisibility();});
  window.addEventListener('assurance-regent-agent-thread-reset',()=>{resetFloatingMessages();threadSynced=true;});
  window.addEventListener('assurance-regent-agent-message',e=>{const d=e.detail||{};if(d.temporary)return;addFloatingMessage(d.role||'assistant',d.text||'',d.label||'');});
  window.addEventListener('assurance-regent-agent-response',e=>{const d=e.detail||{};refreshIdentity();const reply=d.response?.text;if(reply){setStatus(`Ready in ${viewName()}.`);if(!d.noSpeak)speak(reply);}else if(d.error)setStatus(d.error);});
  window.addEventListener('assurance-regent-agent-actions',e=>{const ok=(e.detail?.results||[]).filter(x=>x.ok);if(ok.length)setStatus(`Completed ${ok.length} interface action${ok.length===1?'':'s'}. Ready for your next instruction.`);refreshIdentity();});
  window.addEventListener('assurance-regent-session-ready',()=>{sessionStartedAt=Date.now();threadSynced=false;refreshIdentity();refreshDeviceLocation().catch(()=>{});scheduleSessionGreeting();});
  window.addEventListener('assurance-regent-notifications-change',e=>{const d=e.detail||{};if(Number(d.count||0)>Number(d.previous||0))runProactive('notifications',{count:d.count,items:d.items||[]}).catch(()=>{});});
  window.addEventListener('assurance-regent-workday-event',e=>{const d=e.detail||{},now=new Date(),mins=now.getHours()*60+now.getMinutes();if(d.type==='clock_out'&&mins>=930)runProactive('end_day').catch(()=>{});});
  window.addEventListener('assurance-regent-agent-download',e=>addFloatingDownload(e.detail||{}));
  window.addEventListener('assurance-regent-jivan-tasks',e=>refreshTaskBadge(e.detail?.tasks||[]));
  window.addEventListener('assurance-regent-jivan-task-progress',e=>{const d=e.detail||{};refreshTaskBadge(bridge?.getBackgroundTasks?.()||[]);if(d.status==='COMPLETED')setStatus(`Jivan completed a delegated task: ${d.task?.title||'background task'}.`);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lastHiddenAt=Date.now();return;}const away=lastHiddenAt?Date.now()-lastHiddenAt:0,last=lastHiddenAt;lastHiddenAt=0;const d=new Date(),mins=d.getHours()*60+d.getMinutes();if(last&&away>=15*60*1000&&mins>=690&&mins<=870)runProactive('lunch_return').catch(()=>{});checkEndOfDay();});
  window.addEventListener('pointerdown',retryPendingSpeech,{passive:true});
  window.addEventListener('keydown',retryPendingSpeech);
  setInterval(checkEndOfDay,5*60*1000);
  window.addEventListener('storage',e=>{if(e.key===VOICE_PREF){voiceEnabled=e.newValue==='1';if(!voiceEnabled&&currentAudio&&!currentAudio.paused){currentAudio.pause();pausedByMute=true;}updateVoiceButton();}});
  window.addEventListener('pagehide',()=>releaseMicrophoneSession());

  if(!attachBridge()){let tries=0;const t=setInterval(()=>{tries++;if(attachBridge()||tries>80)clearInterval(t);},100);}
})();
