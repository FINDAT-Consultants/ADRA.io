  /* Assurance Regent v6.3.100 — uninterrupted Zari primary voice lifecycle START */
  const ZARI_PRIMARY_VOICE_LIFECYCLE_SCHEMA100='6.3.100';
  const speakAuthPromptBeforeContinuity100=speakAuthPrompt;
  let zariPrimarySpeechRun100=0,zariPrimarySpeechTimer100=null;

  function emitZariPrimaryVoiceState100(active,text=''){
    try{window.dispatchEvent(new CustomEvent('assurance-regent-zari-primary-voice-state',{detail:{active:Boolean(active),channel:'ZARI',provider:'EXACT_SIGNIN_HANDOFF',schema:ZARI_PRIMARY_VOICE_LIFECYCLE_SCHEMA100,textLength:String(text||'').length}}));}catch{}
  }
  function trackZariPrimaryVoiceCompletion100(run,text=''){
    const synth=window.speechSynthesis,startAt=Date.now(),maxWait=Math.max(3000,Math.min(90000,1800+String(text||'').length*110));let started=Boolean(synth?.speaking||synth?.pending);
    if(zariPrimarySpeechTimer100)clearInterval(zariPrimarySpeechTimer100);
    zariPrimarySpeechTimer100=setInterval(()=>{
      if(run!==zariPrimarySpeechRun100){clearInterval(zariPrimarySpeechTimer100);zariPrimarySpeechTimer100=null;return;}
      const active=Boolean(synth?.speaking||synth?.pending);if(active)started=true;
      if((started&&!active)||(!started&&Date.now()-startAt>1200)||Date.now()-startAt>maxWait){clearInterval(zariPrimarySpeechTimer100);zariPrimarySpeechTimer100=null;emitZariPrimaryVoiceState100(false,text);}
    },60);
  }
  speakAuthPrompt=function(text=''){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return speakAuthPromptBeforeContinuity100(text);
    const run=++zariPrimarySpeechRun100;
    try{
      // Delegate to the exact existing sign-up/sign-in Zari speech function. No voice, rate, pitch or volume is changed here.
      speakAuthPromptBeforeContinuity100(clean);
      emitZariPrimaryVoiceState100(true,clean);
      trackZariPrimaryVoiceCompletion100(run,clean);
    }catch(err){emitZariPrimaryVoiceState100(false,clean);throw err;}
  };
  window.AssuranceRegentZariPrimaryVoiceLifecycle={schema:ZARI_PRIMARY_VOICE_LIFECYCLE_SCHEMA100,provider:'EXACT_SIGNIN_HANDOFF',sameVoice:true,changesVoice:false,isActive:()=>Boolean(window.speechSynthesis?.speaking||window.speechSynthesis?.pending)};
  /* Assurance Regent v6.3.100 — uninterrupted Zari primary voice lifecycle END */