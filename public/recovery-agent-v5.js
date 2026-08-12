/* Assurance Regent Recovery Agent v5 — persistent interactive console + voice I/O */
(() => {
  'use strict';
  const VOICE_PREF='assurance-regent-recovery-agent-voice-v5';
  const MAX_RECORDING_MS=60000;
  const MAX_AUDIO_BYTES=8*1024*1024;
  const $=(id)=>document.getElementById(id);
  let bridge=null, panel=null, launcher=null, messages=null, input=null, micBtn=null, voiceBtn=null, statusEl=null, contextEl=null, roleEl=null;
  let recorder=null, stream=null, chunks=[], stopTimer=null, sending=false, voiceEnabled=true, currentAudio=null;
  try{const saved=localStorage.getItem(VOICE_PREF);if(saved!==null)voiceEnabled=saved==='1';}catch{}

  const esc=(s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const roleLabel=(role)=>role==='Developer'?'Developer AI':role==='Administrator'?'Administrator AI':'Employee AI';
  const viewName=()=>bridge?.getContext?.()?.title||'Assurance Regent';

  function buildUi(){
    if($('recoveryAgentLauncher'))return;
    launcher=document.createElement('button');launcher.type='button';launcher.id='recoveryAgentLauncher';launcher.className='recovery-agent-launcher';launcher.setAttribute('aria-label','Open Recovery Agent');launcher.innerHTML='<span class="agent-launcher-orb">✦</span><span class="agent-launcher-copy"><b>Recovery</b><small>AI operator</small></span>';
    panel=document.createElement('aside');panel.id='recoveryAgentFloatingPanel';panel.className='recovery-agent-floating-panel';panel.hidden=true;panel.setAttribute('aria-label','Recovery Agent interactive console');
    panel.innerHTML=`
      <header class="raf-head">
        <div class="raf-identity"><span class="raf-orb">✦</span><div><b>Recovery Agent</b><small id="rafContext">Ready</small></div></div>
        <div class="raf-head-actions"><span class="raf-role" id="rafRole">AI</span><button type="button" class="raf-icon" id="rafVoice" title="Toggle spoken responses" aria-label="Toggle spoken responses">🔊</button><button type="button" class="raf-icon" id="rafClose" aria-label="Close Recovery Agent">×</button></div>
      </header>
      <div class="raf-security" id="rafSecurity">Role guardrails active</div>
      <div class="raf-messages" id="rafMessages" aria-live="polite"><div class="raf-welcome"><b>Interactive session ready.</b><span>Tell me to open a section, inspect the current page, or guide you through a permitted task.</span></div></div>
      <div class="raf-status" id="rafStatus">Waiting for your instruction.</div>
      <form class="raf-form" id="rafForm">
        <textarea id="rafInput" rows="2" placeholder="e.g. Open Payroll and wait for my next instruction" aria-label="Command Recovery Agent"></textarea>
        <div class="raf-controls"><button type="button" class="raf-mic" id="rafMic" aria-label="Speak to Recovery Agent" title="Speak to Recovery Agent">🎙</button><button type="submit" class="raf-send">Send</button></div>
      </form>`;
    document.body.append(launcher,panel);
    messages=$('rafMessages');input=$('rafInput');micBtn=$('rafMic');voiceBtn=$('rafVoice');statusEl=$('rafStatus');contextEl=$('rafContext');roleEl=$('rafRole');
    launcher.addEventListener('click',()=>setOpen(true));$('rafClose').addEventListener('click',()=>setOpen(false));$('rafForm').addEventListener('submit',async e=>{e.preventDefault();await sendCurrent();});
    $('agentVoiceMain')?.addEventListener('click',()=>{setOpen(true);setStatus(voiceEnabled?'Spoken responses are enabled.':'Spoken responses are muted. Use the speaker button to enable them.');});
    $('agentMicMain')?.addEventListener('click',()=>{setOpen(true);micBtn.click();});
    voiceBtn.addEventListener('click',()=>{voiceEnabled=!voiceEnabled;try{localStorage.setItem(VOICE_PREF,voiceEnabled?'1':'0');}catch{}updateVoiceButton();setStatus(voiceEnabled?'Spoken responses enabled.':'Spoken responses muted.');});
    micBtn.addEventListener('click',()=>recorder?.state==='recording'?stopRecording():startRecording());
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('rafForm').requestSubmit();}});
    updateVoiceButton();refreshIdentity();
  }

  function setOpen(open){panel.hidden=!open;launcher.classList.toggle('panel-open',open);if(open){refreshIdentity();setTimeout(()=>input?.focus(),50);}}
  function setStatus(text,busy=false){if(!statusEl)return;statusEl.textContent=text||'';statusEl.classList.toggle('busy',busy);}
  function updateVoiceButton(){if(!voiceBtn)return;voiceBtn.textContent=voiceEnabled?'🔊':'🔇';voiceBtn.classList.toggle('active',voiceEnabled);voiceBtn.title=voiceEnabled?'Spoken responses on':'Spoken responses off';}
  function refreshIdentity(){
    if(!bridge)return;const user=bridge.getUser?.(),ctx=bridge.getContext?.();const signed=Boolean(user);
    launcher.hidden=!signed;if(!signed){panel.hidden=true;return;}
    roleEl.textContent=roleLabel(user.role);roleEl.dataset.role=user.role||'Employee';contextEl.textContent=`${ctx?.title||'Assurance Regent'} · ${user.name||user.id||user.role}`;
    const security=$('rafSecurity');if(security){security.textContent=user.role==='Developer'?'Developer scope · destructive/security changes still require guardrails':user.role==='Administrator'?'Company-scoped AI · no Developer or cross-company access':'Personal/limited AI · private and administrative areas blocked';}
  }

  function addFloatingMessage(role,text,label=''){
    if(!messages||!text)return;messages.querySelector('.raf-welcome')?.remove();const row=document.createElement('div');row.className=`raf-message ${role}`;row.innerHTML=`${label?`<small>${esc(label)}</small>`:''}<div>${esc(text).replace(/\n/g,'<br>')}</div>`;messages.appendChild(row);while(messages.children.length>40)messages.removeChild(messages.firstElementChild);messages.scrollTop=messages.scrollHeight;
  }

  async function sendCurrent(){const text=input.value.trim();if(!text||sending||!bridge)return;input.value='';setOpen(true);sending=true;setStatus(`Working in ${viewName()}…`,true);try{await bridge.send(text,{source:'floating-agent'});}catch(err){setStatus(err?.message||'Recovery Agent could not complete the request.');}finally{sending=false;if(!statusEl?.textContent||statusEl.classList.contains('busy'))setStatus(`Ready in ${viewName()}.`);}}

  async function startRecording(){
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setStatus('Microphone recording is not supported by this browser.');return;}
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const preferred=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported?.(x));recorder=preferred?new MediaRecorder(stream,{mimeType:preferred}):new MediaRecorder(stream);chunks=[];
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};recorder.onstop=()=>finishRecording().catch(err=>setStatus(err?.message||'Could not process microphone audio.'));
      recorder.start(250);micBtn.classList.add('recording');micBtn.textContent='■';setStatus('Listening… click stop when you finish speaking.',true);stopTimer=setTimeout(()=>stopRecording(),MAX_RECORDING_MS);
    }catch(err){cleanupRecording();setStatus(err?.name==='NotAllowedError'?'Microphone permission was not granted.':'Could not start the microphone.');}
  }
  function stopRecording(){if(recorder?.state==='recording')recorder.stop();clearTimeout(stopTimer);stopTimer=null;micBtn?.classList.remove('recording');if(micBtn)micBtn.textContent='🎙';}
  function cleanupRecording(){clearTimeout(stopTimer);stopTimer=null;try{stream?.getTracks?.().forEach(t=>t.stop());}catch{}stream=null;recorder=null;chunks=[];if(micBtn){micBtn.classList.remove('recording');micBtn.textContent='🎙';}}
  async function finishRecording(){
    const mime=recorder?.mimeType||chunks[0]?.type||'audio/webm';const blob=new Blob(chunks,{type:mime});try{stream?.getTracks?.().forEach(t=>t.stop());}catch{}stream=null;recorder=null;chunks=[];
    if(!blob.size){setStatus('No microphone audio was captured.');return;}if(blob.size>MAX_AUDIO_BYTES){setStatus('That recording is too long. Please keep voice commands under about one minute.');return;}
    setStatus('Transcribing your voice command…',true);const audioBase64=await blobToBase64(blob);const result=await bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime});const transcript=String(result?.text||'').trim();if(!transcript){setStatus('I could not hear a clear command.');return;}input.value=transcript;setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}”`);await sendCurrent();
  }
  function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error||new Error('Could not read recorded audio.'));r.readAsDataURL(blob);});}

  async function speak(text){
    if(!voiceEnabled||!bridge||!text)return;const clean=String(text).replace(/\s+/g,' ').trim().slice(0,1800);if(!clean)return;
    try{const result=await bridge.invoke({mode:'speech',text:clean});if(!result?.audio_base64)return;currentAudio?.pause?.();const audio=new Audio(`data:${result.mime_type||'audio/mpeg'};base64,${result.audio_base64}`);currentAudio=audio;await audio.play();}catch(err){console.warn('Recovery Agent voice unavailable:',err);}
  }

  function attachBridge(){bridge=window.AssuranceRegentAgentBridge||null;if(!bridge)return false;buildUi();refreshIdentity();return true;}

  window.addEventListener('assurance-regent-agent-ready',()=>attachBridge());
  window.addEventListener('assurance-regent-agent-message',e=>{const d=e.detail||{};if(d.temporary)return;addFloatingMessage(d.role||'assistant',d.text||'',d.label||'');});
  window.addEventListener('assurance-regent-agent-response',e=>{const d=e.detail||{};refreshIdentity();const reply=d.response?.text;if(reply){setStatus(`Ready in ${d.context?.title||viewName()}.`);speak(reply);}else if(d.error)setStatus(d.error);});
  window.addEventListener('assurance-regent-agent-actions',e=>{const d=e.detail||{},done=(d.results||[]).filter(x=>x.ok);if(done.length)setStatus(`${d.context?.title||viewName()} is open. Waiting for your next instruction.`);refreshIdentity();});
  window.addEventListener('assurance-regent-view-change',e=>{refreshIdentity();if(panel&&!panel.hidden)setStatus(`${e.detail?.title||viewName()} is open. Waiting for your next instruction.`);});
  window.addEventListener('storage',e=>{if(e.key===VOICE_PREF){voiceEnabled=e.newValue==='1';updateVoiceButton();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshIdentity();});
  if(!attachBridge()){let tries=0;const timer=setInterval(()=>{if(attachBridge()||++tries>100)clearInterval(timer);},100);}
  setInterval(()=>refreshIdentity(),1500);
})();
