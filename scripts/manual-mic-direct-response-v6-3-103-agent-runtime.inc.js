  /* Assurance Regent v6.3.103 — manual microphone means deliberate user instruction START */
  const MANUAL_MIC_RESPONSE_SCHEMA103='6.3.103';
  const startVoiceConversationBeforeManualMic103=startVoiceConversation;

  // A user clicking the microphone is already an explicit invocation. Do not require
  // them to repeat “Jivan” or “Zari” before their first spoken instruction.
  // Automatically resumed/background listening keeps the v6.3.102 wake-name guard.
  startVoiceConversation=async function(options={}){
    const opts=options&&typeof options==='object'?options:{};
    const automatic=Boolean(opts.automatic);
    const started=await startVoiceConversationBeforeManualMic103(options);
    if(started&&!automatic){
      voiceWake102();
      setStatus('Mic active · speak your instruction. Jivan will respond after you pause.');
    }
    return started;
  };

  window.AssuranceRegentVoiceWakePolicy={
    ...(window.AssuranceRegentVoiceWakePolicy||{}),
    schema:MANUAL_MIC_RESPONSE_SCHEMA103,
    manualMicStartsEngaged:true,
    manualMicRequiresWakeName:false,
    automaticBackgroundRequiresAddress:true,
    backgroundAudioRoutedToAgent:false,
    notificationsSpoken:false,
    notificationBadgesRemain:true
  };
  /* Assurance Regent v6.3.103 — manual microphone means deliberate user instruction END */
