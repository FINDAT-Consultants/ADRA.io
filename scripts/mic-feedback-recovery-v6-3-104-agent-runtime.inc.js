  /* Assurance Regent v6.3.104 — reliable manual mic capture + feedback recovery START */
  const MIC_FEEDBACK_RECOVERY_SCHEMA104='6.3.104';
  const MANUAL_CAPTURE_ARM_MS104=15000;
  const MANUAL_CAPTURE_GRACE_MS104=2600;
  const TRANSCRIBE_TIMEOUT_MS104=18000;
  const SEND_TIMEOUT_MS104=30000;
  const RESPONSE_WATCHDOG_MS104=18000;
  let manualCaptureUntil104=0,manualCaptureTimer104=null,responseWatchdog104=null;

  function manualCaptureArmed104(){return Boolean(conversationMode&&Date.now()<manualCaptureUntil104);}
  function clearManualCapture104(){manualCaptureUntil104=0;if(manualCaptureTimer104){clearTimeout(manualCaptureTimer104);manualCaptureTimer104=null;}}
  function clearResponseWatchdog104(){if(responseWatchdog104){clearTimeout(responseWatchdog104);responseWatchdog104=null;}}
  function withTimeout104(promise,ms,label){
    return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(done)return;done=true;reject(new Error(label));},Math.max(1000,Number(ms||0)));Promise.resolve(promise).then(value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);},err=>{if(done)return;done=true;clearTimeout(timer);reject(err);});});
  }
  function resetVoiceTurn104(message='Mic ready · speak your instruction.',delay=320){
    clearResponseWatchdog104();sending=false;awaitingVoiceReply=false;conversationTurnBusy=false;updateConversationUi();setStatus(message);if(conversationMode)scheduleConversationListen(delay);
  }
  function scheduleResponseWatchdog104(){
    clearResponseWatchdog104();responseWatchdog104=setTimeout(function check(){
      responseWatchdog104=null;if(!conversationMode||!awaitingVoiceReply)return;if(jivanSpeaking){responseWatchdog104=setTimeout(check,4000);return;}resetVoiceTurn104('I did not receive a response in time. The microphone is ready — please try the instruction again.',300);
    },RESPONSE_WATCHDOG_MS104);
  }

  // Remember microphone permission, but do not auto-open a live conversation after sign-in.
  // This prevents an already-running background mic from confusing a deliberate user click.
  const primeRememberedMicrophoneBeforeRecovery104=primeRememberedMicrophone;
  primeRememberedMicrophone=async function(options={}){
    const opts=options&&typeof options==='object'?options:{};
    return primeRememberedMicrophoneBeforeRecovery104({...opts,resumeConversation:false,autoStartGranted:false});
  };

  const startVoiceConversationBeforeRecovery104=startVoiceConversation;
  startVoiceConversation=async function(options={}){
    const opts=options&&typeof options==='object'?options:{},automatic=Boolean(opts.automatic);
    if(!automatic){clearManualCapture104();manualCaptureUntil104=Date.now()+MANUAL_CAPTURE_ARM_MS104;voiceWake102();setStatus('Starting microphone…',true);}
    const started=await startVoiceConversationBeforeRecovery104(options);
    if(!started){if(!automatic)clearManualCapture104();return false;}
    if(!automatic){voiceWake102();setStatus('Mic active · listening now. Speak your instruction, then pause.');}
    return true;
  };

  // Manual mic activation gets a guaranteed capture window instead of relying only on VAD.
  // A short grace period lets the user begin speaking before silence can close the turn.
  const startConversationMonitorBeforeRecovery104=startConversationMonitor;
  startConversationMonitor=async function(){
    const started=await startConversationMonitorBeforeRecovery104();
    if(started&&manualCaptureArmed104()){
      if(manualCaptureTimer104)clearTimeout(manualCaptureTimer104);
      manualCaptureTimer104=setTimeout(()=>{
        manualCaptureTimer104=null;if(!manualCaptureArmed104())return;
        if(recorder?.state==='recording'){clearManualCapture104();return;}
        if(!conversationMode||jivanSpeaking||sending||conversationTurnBusy||awaitingVoiceReply)return;
        const activeStream=microphoneSessionStream;
        if(!activeStream||!(activeStream.getAudioTracks?.()||[]).some(t=>t.readyState==='live')){resetVoiceTurn104('The microphone stream was not ready. Please tap the mic and try again.',300);clearManualCapture104();return;}
        voiceWake102();const begun=beginConversationCapture(activeStream,Date.now()+MANUAL_CAPTURE_GRACE_MS104);clearManualCapture104();
        if(begun){setStatus('Listening… I am capturing your instruction. Pause when you finish.');updateConversationUi();}
        else resetVoiceTurn104('I could not start recording. Please tap the mic and try again.',300);
      },180);
    }
    return started;
  };

  // Replace the voice-turn completion path with explicit progress states and hard recovery timeouts.
  finishConversationTurn=async function(rec,generation){
    const mime=rec?.mimeType||chunks[0]?.type||'audio/webm',blob=new Blob(chunks,{type:mime});const shouldDiscard=discardConversationTurn||generation!==conversationGeneration||!conversationMode;recorder=null;chunks=[];parkMicrophoneSession();updateConversationUi();clearManualCapture104();
    if(shouldDiscard){discardConversationTurn=false;resetVoiceTurn104('Mic ready · tap the microphone when you want to speak.',260);return;}
    if(!blob.size||blob.size<900){resetVoiceTurn104('I did not capture enough speech. Tap the mic and speak again.',260);return;}
    if(blob.size>MAX_AUDIO_BYTES){resetVoiceTurn104('That voice turn was too long. Please use a shorter instruction.',300);return;}
    setStatus('Audio captured · understanding what you said…',true);
    try{
      const audioBase64=await blobToBase64(blob);
      const result=await withTimeout104(bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime}),TRANSCRIBE_TIMEOUT_MS104,'Speech recognition took too long.');
      const transcript=String(result?.text||'').trim();
      if(!transcript){resetVoiceTurn104('I could not detect clear speech. Tap the mic and try again.',280);return;}
      const addressed=voiceAddressed102(transcript),engaged=voiceWakeActive102();
      if(!addressed&&!engaged){resetVoiceTurn104('Background audio ignored. Tap the mic when you want to speak to Jivan or Zari.',300);return;}
      voiceWake102();setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}” · processing your instruction…`,true);awaitingVoiceReply=true;conversationTurnBusy=true;sending=true;updateConversationUi();
      if(instructionNeedsLocation(transcript))await refreshDeviceLocation();
      await withTimeout104(bridge.send(transcript,{source:'voice-conversation',directVoiceSubmit:true,continuousConversation:true,addressedWake:addressed,manualMic:true}),SEND_TIMEOUT_MS104,'The assistant response took too long.');
      sending=false;if(conversationMode&&awaitingVoiceReply){setStatus('Instruction received · preparing the response…',true);scheduleResponseWatchdog104();}
    }catch(err){console.warn('Manual microphone turn failed:',err);resetVoiceTurn104(err?.message||'I could not process that microphone instruction. Please try again.',320);}
  };

  window.addEventListener('assurance-regent-agent-response',e=>{const d=e.detail||{};if(d.response?.text||d.error)clearResponseWatchdog104();});
  window.addEventListener('assurance-regent-session-ended',()=>{clearManualCapture104();clearResponseWatchdog104();});
  window.addEventListener('pagehide',()=>{clearManualCapture104();clearResponseWatchdog104();});

  window.AssuranceRegentMicRecoveryPolicy={schema:MIC_FEEDBACK_RECOVERY_SCHEMA104,manualMicImmediateCapture:true,manualCaptureGraceMs:MANUAL_CAPTURE_GRACE_MS104,transcriptionTimeoutMs:TRANSCRIBE_TIMEOUT_MS104,responseTimeoutMs:SEND_TIMEOUT_MS104,autoResumeConversation:false,notificationsSpoken:false,backgroundAudioRoutedToAgent:false,voicePath:'ZARI_APPROVED'};
  /* Assurance Regent v6.3.104 — reliable manual mic capture + feedback recovery END */
