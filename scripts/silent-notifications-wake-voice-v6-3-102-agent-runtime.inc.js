  /* Assurance Regent v6.3.102 — silent notifications + addressed voice wake START */
  const SILENT_NOTIFICATION_WAKE_SCHEMA102='6.3.102';
  const VOICE_WAKE_WINDOW_MS102=90*1000;
  let voiceWakeUntil102=0;

  function voiceWakeActive102(){return Boolean(conversationMode&&Date.now()<voiceWakeUntil102);}
  function voiceAddressed102(text=''){
    return /^\s*(?:(?:hey|hi|hello|okay|ok)\s+)?(?:jivan|jeevan|zari)\b[\s,:;.!?-]*/i.test(String(text||''));
  }
  function voiceWake102(){voiceWakeUntil102=Date.now()+VOICE_WAKE_WINDOW_MS102;}
  function voiceSleep102(){voiceWakeUntil102=0;}

  // Notifications remain visible in the normal notification UI, but they never produce proactive AI speech.
  const runProactiveBeforeSilentNotifications102=runProactive;
  runProactive=async function(reason,extra={}){
    if(String(reason||'').toLowerCase()==='notifications'){
      try{if(reminderFlushTimer101)clearTimeout(reminderFlushTimer101);}catch{}
      try{reminderFlushTimer101=null;reminderPendingNotifications101.clear();}catch{}
      return null;
    }
    return runProactiveBeforeSilentNotifications102(reason,extra);
  };

  // More conservative local VAD while waiting for a deliberate wake phrase; once engaged, normal conversation sensitivity returns.
  startConversationMonitor=async function(){
    if(!conversationCanListen()||conversationMonitoring)return false;if(!conversationSupported()){setStatus('Hands-free voice conversation is not supported by this browser.');return false;}
    try{const activeStream=await acquireMicrophoneSession();if(!conversationCanListen()){parkMicrophoneSession();return false;}activeStream.getAudioTracks?.().forEach(t=>{if(t.readyState==='live')t.enabled=true;});
      const AudioCtx=window.AudioContext||window.webkitAudioContext;audioContext=new AudioCtx();try{await audioContext.resume?.();}catch{}analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.14;vadSource=audioContext.createMediaStreamSource(activeStream);vadSource.connect(analyser);vadData=new Uint8Array(analyser.fftSize);conversationMonitoring=true;conversationNoiseFloor=Math.max(.004,Math.min(conversationNoiseFloor,.018));conversationSpeechFrames=0;updateConversationUi();setStatus(voiceWakeActive102()?'Voice conversation active · listening for your reply.':'Voice ready · say “Jivan” or “Zari” when you want to speak to the assistant.');
      const generation=conversationGeneration;const tick=()=>{
        if(generation!==conversationGeneration||!conversationMonitoring||!conversationCanListen()||!analyser||!vadData){pauseConversationMonitor(true);return;}
        analyser.getByteTimeDomainData(vadData);let sum=0;for(let i=0;i<vadData.length;i++){const v=(vadData[i]-128)/128;sum+=v*v;}const rms=Math.sqrt(sum/vadData.length),now=Date.now(),engaged=voiceWakeActive102();const threshold=engaged?Math.max(.016,conversationNoiseFloor*2.7):Math.max(.024,conversationNoiseFloor*3.5),speechFramesNeeded=engaged?3:5;
        if(recorder?.state==='recording'){
          if(rms>Math.max(engaged?.012:.018,conversationNoiseFloor*(engaged?1.85:2.2))){silenceStartedAt=0;}
          else{if(!silenceStartedAt)silenceStartedAt=now;if(now-silenceStartedAt>VOICE_END_SILENCE_MS&&now-recordingStartedAt>500){stopConversationCapture('silence');return;}}
          if(now-recordingStartedAt>=MAX_RECORDING_MS){stopConversationCapture('timeout');return;}
        }else{
          if(rms<threshold){conversationNoiseFloor=(conversationNoiseFloor*.985)+(rms*.015);conversationSpeechFrames=0;}
          else{conversationSpeechFrames++;if(conversationSpeechFrames>=speechFramesNeeded){conversationSpeechFrames=0;beginConversationCapture(activeStream,now);}}
        }
        vadFrame=requestAnimationFrame(tick);
      };vadFrame=requestAnimationFrame(tick);return true;
    }catch(err){pauseConversationMonitor(true);setStatus(err?.name==='NotAllowedError'?'The browser has not granted microphone access to Assurance Regent. Allow this site once, then start Voice conversation again.':'Could not start Jivan voice conversation.');return false;}
  };

  finishConversationTurn=async function(rec,generation){
    const mime=rec?.mimeType||chunks[0]?.type||'audio/webm',blob=new Blob(chunks,{type:mime});const shouldDiscard=discardConversationTurn||generation!==conversationGeneration||!conversationMode;recorder=null;chunks=[];parkMicrophoneSession();updateConversationUi();
    if(shouldDiscard){discardConversationTurn=false;conversationTurnBusy=false;awaitingVoiceReply=false;return;}if(!blob.size||blob.size<900){conversationTurnBusy=false;setStatus(voiceWakeActive102()?'Voice conversation active · listening for your reply.':'Voice ready · say “Jivan” or “Zari” when you want to speak to the assistant.');scheduleConversationListen(220);return;}if(blob.size>MAX_AUDIO_BYTES){conversationTurnBusy=false;setStatus('That voice turn was too long. Please speak in shorter turns.');scheduleConversationListen(300);return;}
    setStatus('Checking for directed speech…',true);try{const audioBase64=await blobToBase64(blob);const result=await bridge.invoke({mode:'transcribe',audio_base64:audioBase64,mime_type:mime});const transcript=String(result?.text||'').trim();if(!transcript){conversationTurnBusy=false;setStatus(voiceWakeActive102()?'Voice conversation active · listening for your reply.':'Voice ready · say “Jivan” or “Zari” when you want to speak to the assistant.');scheduleConversationListen(260);return;}
      const addressed=voiceAddressed102(transcript),engaged=voiceWakeActive102();if(!addressed&&!engaged){conversationTurnBusy=false;awaitingVoiceReply=false;setStatus('Background audio ignored · say “Jivan” or “Zari” when you want the assistant.');scheduleConversationListen(280);return;}
      voiceWake102();setStatus(`Heard: “${transcript.slice(0,100)}${transcript.length>100?'…':''}” — responding.`,true);awaitingVoiceReply=true;sending=true;if(instructionNeedsLocation(transcript))await refreshDeviceLocation();await bridge.send(transcript,{source:'voice-conversation',directVoiceSubmit:true,continuousConversation:true,addressedWake:addressed});
    }catch(err){awaitingVoiceReply=false;conversationTurnBusy=false;setStatus(err?.message||'Jivan could not complete that voice turn.');scheduleConversationListen(350);}finally{sending=false;if(conversationMode&&awaitingVoiceReply){setTimeout(()=>{if(conversationMode&&awaitingVoiceReply&&!jivanSpeaking){awaitingVoiceReply=false;conversationTurnBusy=false;scheduleConversationListen(220);}},12000);}}
  };

  window.addEventListener('assurance-regent-agent-response',()=>{if(conversationMode&&voiceWakeActive102())voiceWake102();});
  window.addEventListener('assurance-regent-session-ended',voiceSleep102);
  window.addEventListener('pagehide',voiceSleep102);

  window.AssuranceRegentVoiceWakePolicy={schema:SILENT_NOTIFICATION_WAKE_SCHEMA102,wakeNames:['Jivan','Jeevan','Zari'],idleRequiresAddress:true,engagedWindowSeconds:90,backgroundAudioRoutedToAgent:false,notificationsSpoken:false,notificationBadgesRemain:true};
  /* Assurance Regent v6.3.102 — silent notifications + addressed voice wake END */
