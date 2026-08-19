  /* Assurance Regent v6.3.98 — Jivan uses Zari synthetic voice START */
  const JIVAN_ZARI_VOICE_SCHEMA98='6.3.98';
  const jivanSpeakBase98=speak;

  speak=async function(text){
    if(!voiceEnabled||!text)return false;
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return false;
    const shared=window.AssuranceRegentZariVoice;
    if(!shared?.speak)return jivanSpeakBase98(clean);
    const stopRun=userSpeechStopRun;
    try{
      setSpeakingUi(true);setStatus('Jivan is speaking…');
      const spoken=await shared.speak(clean,{channel:'JIVAN',interrupt:true});
      if(stopRun!==userSpeechStopRun){setSpeakingUi(false);return false;}
      setSpeakingUi(false);
      if(spoken){setStatus(`Ready in ${viewName()}.`);return true;}
      return jivanSpeakBase98(clean);
    }catch(err){
      setSpeakingUi(false);console.warn('Shared Zari voice unavailable for Jivan:',err);
      return jivanSpeakBase98(clean);
    }
  };

  window.AssuranceRegentJivanVoiceBridge={schema:JIVAN_ZARI_VOICE_SCHEMA98,provider:'ZARI_SYNTHETIC_VOICE',shared:true,getVoice:()=>window.AssuranceRegentZariVoice?.getVoice?.()||null};
  /* Assurance Regent v6.3.98 — Jivan uses Zari synthetic voice END */