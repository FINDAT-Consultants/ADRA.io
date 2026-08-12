/* Assurance Regent Recovery Agent v5.2.1 — proactive role-aware operator + voice + documents */
(() => {
  'use strict';
  const VOICE_PREF='assurance-regent-recovery-agent-voice-v5';
  const MAX_RECORDING_MS=60000;
  const MAX_AUDIO_BYTES=8*1024*1024;
  const $=(id)=>document.getElementById(id);
  let bridge=null, panel=null, launcher=null, messages=null, input=null, micBtn=null, voiceBtn=null, statusEl=null, contextEl=null, roleEl=null;
  let recorder=null, stream=null, chunks=[], stopTimer=null, sending=false, voiceEnabled=true, currentAudio=null, pausedByMute=false, pendingSpeech='';
  let lastHiddenAt=0, sessionStartedAt=Date.now(), proactiveBusy=false;
  let threadSynced=false, threadLoading=false, lastUserId='';
  try{const saved=localStorage.getItem(VOICE_PREF);if(saved!==null)voiceEnabled=saved==='1';}catch{}

  const esc=(s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=(role)=>role==='Developer'?'Developer AI':role==='Administrator'?'Administrator AI':'Employee AI';
  const context=()=>bridge?.getContext?.()||{};
  const viewName=()=>context()?.title||'Assurance Regent';
  const onAgentPage=()=>context()?.view==='assistant';
  const profileControlOpen=()=>document.body.classList.contains('control-profile-open')||Boolean(document.querySelector('#controlDrawer:not([hidden]) #controlPaneProfile:not([hidden])'));

  function buildUi(){
    if($('recoveryAgentLauncher'))return;
    launcher=document.createElement('button');launcher.type='button';launcher.id='recoveryAgentLauncher';launcher.className='recovery-agent-launcher';launcher.setAttribute('aria-label','Open Recovery Agent');launcher.innerHTML='<span class="agent-launcher-orb">✦</span><span class="agent-launcher-copy"><b>Recovery</b><small>AI operator</small></span>';
    panel=document.createElement('aside');panel.id='recoveryAgentFloatingPanel';panel.className='recovery-agent-floating-panel';panel.hidden=true;panel.setAttribute('aria-label','Recovery Agent interactive console');
    panel.innerHTML=`
      <header class="raf-head">
        <div class="raf-identity"><span class="raf-orb">✦</span><div><b>Recovery Agent</b><small id="rafContext">Ready</small></div></div>
        <div class="raf-head-actions"><span class="raf-role" id="rafRole">AI</span><button type="button" class="raf-icon raf-clear" id="rafClear" title="Clear this Recovery Agent conversation" aria-label="Clear Recovery Agent conversation">Clear</button><button type="button" class="raf-icon" id="rafVoice" title="Mute spoken responses" aria-label="Mute or unmute spoken responses">🔊</button><button type="button" class="raf-icon" id="rafClose" aria-label="Close Recovery Agent">×</button></div>
      </header>
      <div class="raf-security" id="rafSecurity">Role guardrails active</div>
      <div class="raf-messages" id="rafMessages" aria-live="polite"><div class="raf-welcome"><b>Interactive session ready.</b><span>Tell me to open a section, inspect the current page, or guide you through a permitted task.</span></div></div>
      <div class="raf-status" id="rafStatus">Waiting for your instruction.</div>
      <form class="raf-form" id="rafForm">
        <textarea id="rafInput" rows="2" placeholder="e.g. Open Payroll and wait for my next instruction" aria-label="Command Recovery Agent"></textarea>
        <div class="raf-controls"><button type="button" class="raf-mic" id="rafMic" aria-label="Speak to Recovery Agent" title="Start microphone recording">🎙 Mic</button><button type="button" class="raf-upload" id="rafUpload" aria-label="Upload a document to Recovery Agent" title="Upload document">＋ File</button><button type="submit" class="raf-send">Send</button><input id="rafFileInput" type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.png,.jpg,.jpeg,.webp,image/*" /></div>
      </form>`;
    document.body.append(launcher,panel);
    messages=$('rafMessages');input=$('rafInput');micBtn=$('rafMic');voiceBtn=$('rafVoice');statusEl=$('rafStatus');contextEl=$('rafContext');roleEl=$('rafRole');
    launcher.addEventListener('click',()=>setOpen(true));
    $('rafClose').addEventListener('click',()=>setOpen(false));
    $('rafClear').addEventListener('click',()=>clearConversation());
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
    messages.innerHTML='<div class="raf-welcome"><b>Interactive session ready.</b><span>Tell me to open a section, inspect the current page, or guide you through a permitted task.</span></div>';
  }

  async function syncThread(){
    if(!bridge?.loadThread||threadLoading||threadSynced)return;
    threadLoading=true;
    try{await bridge.loadThread();threadSynced=true;}catch(err){console.warn('Recovery Agent conversation sync unavailable:',err);}finally{threadLoading=false;}
  }

  function refreshVisibility(){
    if(!launcher||!panel||!bridge)return;
    const signed=Boolean(bridge.getUser?.());
    const hiddenForAgentPage=onAgentPage(), hiddenForProfile=profileControlOpen();
    launcher.hidden=!signed||hiddenForAgentPage||hiddenForProfile;
    if(!signed||hiddenForAgentPage||hiddenForProfile){panel.hidden=true;launcher.classList.remove('panel-open');}
  }

  function setOpen(open){
    if(!panel||!launcher)return;
    if(onAgentPage()||profileControlOpen()){panel.hidden=true;launcher.hidden=true;launcher.classList.remove('panel-open');if(onAgentPage())$('chatInput')?.focus();return;}
    panel.hidden=!open;launcher.classList.toggle('panel-open',open);
    if(open){refreshIdentity();syncThread();setTimeout(()=>input?.focus(),50);}
  }
  function setStatus(text,busy=false){if(statusEl){statusEl.textContent=text||'';statusEl.classList.toggle('busy',busy);}const main=$('agentAudioStatus');if(main&&onAgentPage())main.textContent=text||'';}

  function updateVoiceButton(){
    if(voiceBtn){voiceBtn.textContent=voiceEnabled?'🔊':'🔇';voiceBtn.classList.toggle('active',voiceEnabled);voiceBtn.title=voiceEnabled?'Mute spoken responses':'Unmute spoken responses';voiceBtn.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
    const main=$('agentVoiceMain');if(main){main.textContent=voiceEnabled?'Mute voice':'Unmute voice';main.title=voiceEnabled?'Mute Recovery Agent spoken responses':'Unmute Recovery Agent spoken responses';main.classList.toggle('active',voiceEnabled);main.setAttribute('aria-pressed',voiceEnabled?'true':'false');}
  }

  async function toggleVoice(){
    voiceEnabled=!voiceEnabled;
    try{localStorage.setItem(VOICE_PREF,voiceEnabled?'1':'0');}catch{}
    if(!voiceEnabled){
      if(currentAudio&&!currentAudio.ended&&!currentAudio.paused){currentAudio.pause();pausedByMute=true;}
      setStatus('Recovery Agent voice muted.');
    }else{
      setStatus('Recovery Agent voice unmuted.');
      if(pausedByMute&&currentAudio&&!currentAudio.ended){try{await currentAudio.play();pausedByMute=false;}catch{setStatus('Voice is unmuted. Audio will resume with the next response.');}}
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
    setStatus('Clearing Recovery Agent conversation…',true);
    try{await bridge.clearConversation(false);resetFloatingMessages();threadSynced=true;setStatus('Conversation cleared everywhere.');}
    catch(err){setStatus(err?.message||'Could not clear the Recovery Agent conversation.');}
  }

  async function sendCurrent(){const text=input?.value.trim();if(!text||sending||!bridge)return;if(input)input.value='';setOpen(true);sending=true;setStatus(`Working in ${viewName()}…`,true);try{await bridge.send(text,{source:'floating-agent'});}catch(err){setStatus(err?.message||'Recovery Agent could not complete the request.');}finally{sending=false;if(!statusEl?.textContent||statusEl.classList.contains('busy'))setStatus(`Ready in ${viewName()}.`);}}

  async function microphonePermissionState(){
    try{if(navigator.permissions?.query){const p=await navigator.permissions.query({name:'microphone'});return p?.state||'unknown';}}catch{}
    return 'unknown';
  }

  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setStatus('Microphone recording is not supported by this browser.');return;}
    if(recorder?.state==='recording')return;
    try{
      const permission=await microphonePermissionState();
      if(permission==='denied'){setStatus('Microphone access is blocked in the browser site settings. Enable it once, then the microphone can start directly.');return;}
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported?.(x));recorder=preferred?new MediaRecorder(stream,{mimeType:preferred}):new MediaRecorder(stream);chunks=[];
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onstop=()=>finishRecording().catch(err=>setStatus(err?.message||'Could not process microphone audio.'));
      recorder.start(250);updateRecordingUi(true);setStatus('Listening… press Stop recording when you finish speaking.',true);stopTimer=setTimeout(()=>stopRecording(),MAX_RECORDING_MS);
    }catch(err){cleanupRecording();setStatus(err?.name==='NotAllowedError'?'Microphone permission is required by the browser before recording can begin. Allow it for this site once, then future recordings can start directly.':'Could not start the microphone.');}
  }
  function stopRecording(){if(recorder?.state==='recording')recorder.stop();clearTimeout(stopTimer);stopTimer=null;updateRecordingUi(false);setStatus('Recording stopped. Processing your command…',true);}
  function cleanupRecording(){clearTimeout(stopTimer);stopTimer=null;try{stream?.getTracks?.().forEach(t=>t.stop());}catch{}stream=null;recorder=null;chunks=[];updateRecordingUi(false);}
  async function finishRecording(){
    const mime=recorder?.mimeType||chunks[0]?.type||'audio/webm';const blob=new Blob(chunks,{type:mime});try{stream?.getTracks?.().forEach(t=>t.stop());}catch{}stream=null;recorder=null;chunks=[];updateRecordingUi(false);
    if(!blob.size){setStatus('No microphone audio was captured.');return;}if(blob.size>MAX_AUDIO_BYTES){setStatus('That recording is too long. Please keep voice commands under about one minute.');return;}
    setStatus('Transcribing your voice command…',true);const audioBase64=await blobToBase64(blob);const result=await bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime});const transcript=String(result?.text||'').trim();if(!transcript){setStatus('I could not hear a clear command.');return;}
    if(onAgentPage()&&$('chatInput'))$('chatInput').value=transcript;else if(input)input.value=transcript;
    setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}”`);
    sending=true;try{await bridge.send(transcript,{source:'voice-agent'});if($('chatInput'))$('chatInput').value='';if(input)input.value='';}catch(err){setStatus(err?.message||'Recovery Agent could not complete the voice command.');}finally{sending=false;}
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
      bridge.showMessage?.(text,reason==='notifications'?'Recovery Agent notification':'Recovery Agent');
      setStatus(text.length>150?`${text.slice(0,147)}…`:text);
      await speak(text);
      return text;
    }catch(err){console.warn('Proactive Recovery Agent message unavailable:',err);return null;}finally{proactiveBusy=false;}
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
    if(!messages||!download?.url)return;messages.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className='raf-message assistant';row.innerHTML=`<div class="raf-download"><b>${esc(download.name||'Generated file')}</b><br><a href="${esc(download.url)}" download="${esc(download.name||'assurance-regent-export')}">Download file</a></div>`;messages.appendChild(row);messages.scrollTop=messages.scrollHeight;
  }

  async function speak(text){
    if(!voiceEnabled||!bridge||!text)return;const clean=String(text).replace(/\s+/g,' ').trim().slice(0,1800);if(!clean)return;
    try{const result=await bridge.invoke({mode:'speech',text:clean});if(!result?.audio_base64)return;currentAudio?.pause?.();pausedByMute=false;const audio=new Audio(`data:${result.mime_type||'audio/mpeg'};base64,${result.audio_base64}`);currentAudio=audio;audio.addEventListener('ended',()=>{if(currentAudio===audio){currentAudio=null;pausedByMute=false;}});await audio.play();}
    catch(err){console.warn('Recovery Agent voice unavailable:',err);if(err?.name==='NotAllowedError'||/play|gesture|autoplay/i.test(String(err?.message||''))){pendingSpeech=clean;setStatus('Voice is ready and will speak after your next click or key press.');}else setStatus('Spoken response could not play. Text response remains available.');}
  }

  function attachBridge(){bridge=window.AssuranceRegentAgentBridge||null;if(!bridge)return false;buildUi();threadSynced=false;refreshIdentity();if(bridge.getUser?.())scheduleSessionGreeting();return true;}

  window.addEventListener('assurance-regent-agent-ready',()=>attachBridge());
  window.addEventListener('assurance-regent-view-change',()=>{refreshIdentity();refreshVisibility();});
  window.addEventListener('assurance-regent-control-panel-change',e=>{const d=e.detail||{};if(d.open&&d.panel==='profile'){if(panel)panel.hidden=true;if(launcher){launcher.hidden=true;launcher.classList.remove('panel-open');}}else refreshVisibility();});
  window.addEventListener('assurance-regent-agent-thread-reset',()=>{resetFloatingMessages();threadSynced=true;});
  window.addEventListener('assurance-regent-agent-message',e=>{const d=e.detail||{};if(d.temporary)return;addFloatingMessage(d.role||'assistant',d.text||'',d.label||'');});
  window.addEventListener('assurance-regent-agent-response',e=>{const d=e.detail||{};refreshIdentity();const reply=d.response?.text;if(reply){setStatus(`Ready in ${viewName()}.`);if(!d.noSpeak)speak(reply);}else if(d.error)setStatus(d.error);});
  window.addEventListener('assurance-regent-agent-actions',e=>{const ok=(e.detail?.results||[]).filter(x=>x.ok);if(ok.length)setStatus(`Completed ${ok.length} interface action${ok.length===1?'':'s'}. Ready for your next instruction.`);refreshIdentity();});
  window.addEventListener('assurance-regent-session-ready',()=>{sessionStartedAt=Date.now();threadSynced=false;refreshIdentity();scheduleSessionGreeting();});
  window.addEventListener('assurance-regent-notifications-change',e=>{const d=e.detail||{};if(Number(d.count||0)>Number(d.previous||0))runProactive('notifications',{count:d.count,items:d.items||[]}).catch(()=>{});});
  window.addEventListener('assurance-regent-workday-event',e=>{const d=e.detail||{},now=new Date(),mins=now.getHours()*60+now.getMinutes();if(d.type==='clock_out'&&mins>=930)runProactive('end_day').catch(()=>{});});
  window.addEventListener('assurance-regent-agent-download',e=>addFloatingDownload(e.detail||{}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lastHiddenAt=Date.now();return;}const away=lastHiddenAt?Date.now()-lastHiddenAt:0,last=lastHiddenAt;lastHiddenAt=0;const d=new Date(),mins=d.getHours()*60+d.getMinutes();if(last&&away>=15*60*1000&&mins>=690&&mins<=870)runProactive('lunch_return').catch(()=>{});checkEndOfDay();});
  window.addEventListener('pointerdown',retryPendingSpeech,{passive:true});
  window.addEventListener('keydown',retryPendingSpeech);
  setInterval(checkEndOfDay,5*60*1000);
  window.addEventListener('storage',e=>{if(e.key===VOICE_PREF){voiceEnabled=e.newValue==='1';if(!voiceEnabled&&currentAudio&&!currentAudio.paused){currentAudio.pause();pausedByMute=true;}updateVoiceButton();}});

  if(!attachBridge()){let tries=0;const t=setInterval(()=>{tries++;if(attachBridge()||tries>80)clearInterval(t);},100);}
})();
