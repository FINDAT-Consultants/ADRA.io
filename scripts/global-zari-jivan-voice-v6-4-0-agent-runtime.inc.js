  /* Assurance Regent v6.4.0 — Jivan canonical global voice START */
  const JIVAN_GLOBAL_VOICE_SCHEMA640='6.4.0';
  const jivanSpeakBase640=speak;
  const stopSpeakingNowBase640=stopSpeakingNow;

  speak=async function(text){
    if(!voiceEnabled||!text)return false;const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return false;
    const cloud=window.AssuranceRegentCanonicalVoice;if(!cloud?.speak)return jivanSpeakBase640(clean);
    const stopRun=userSpeechStopRun;
    try{
      setSpeakingUi(true);setStatus('Jivan is speaking…');
      const spoken=await cloud.speak(clean,{agent:'JIVAN'});
      if(stopRun!==userSpeechStopRun){setSpeakingUi(false);return false;}
      setSpeakingUi(false);if(spoken){setStatus(`Ready in ${viewName()}.`);return true;}
      return jivanSpeakBase640(clean);
    }catch(err){
      setSpeakingUi(false);console.warn('Canonical Jivan voice unavailable:',err);return jivanSpeakBase640(clean);
    }
  };
  stopSpeakingNow=function(){try{window.AssuranceRegentCanonicalVoice?.stop?.();}catch{}return stopSpeakingNowBase640();};
  window.AssuranceRegentJivanVoiceBridge={schema:JIVAN_GLOBAL_VOICE_SCHEMA640,provider:'OPENAI_SERVER_TTS',voice:'coral',speed:1,global:true,sameAsZari:true};
  /* Assurance Regent v6.4.0 — Jivan canonical global voice END */