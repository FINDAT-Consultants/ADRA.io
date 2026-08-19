  /* Assurance Regent v6.3.100 — uninterrupted Zari voice for Jivan START */
  const ZARI_VOICE_CONTINUITY_SCHEMA100='6.3.100';
  let zariPrimaryVoiceActive100=false,zariPrimaryQuietUntil100=Date.now()+1400,sessionGreetingTimer100=null,zariHandoffGreetingPending100=false;

  function zariPrimaryBusy100(){return Boolean(zariPrimaryVoiceActive100||Date.now()<zariPrimaryQuietUntil100);}
  async function waitForZariPrimaryQuiet100(maxWait=95000){
    const start=Date.now();while(zariPrimaryBusy100()&&Date.now()-start<maxWait)await new Promise(r=>setTimeout(r,80));return !zariPrimaryBusy100();
  }

  // Replace the old Jivan fallback chain. Jivan may speak only through Zari's approved sign-in/handoff voice bridge.
  speak=async function(text){
    if(!voiceEnabled||!text)return false;const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return false;
    await waitForZariPrimaryQuiet100();
    const shared=window.AssuranceRegentZariVoice;
    if(!shared?.speak){setSpeakingUi(false);setStatus('Zari voice is temporarily unavailable. The written response remains available.');return false;}
    const stopRun=userSpeechStopRun;pendingSpeech='';
    try{
      setSpeakingUi(true);setStatus('Jivan is speaking…');
      const spoken=await shared.speak(clean,{channel:'JIVAN'});
      if(stopRun!==userSpeechStopRun){setSpeakingUi(false);return false;}
      setSpeakingUi(false);
      if(spoken){setStatus(`Ready in ${viewName()}.`);return true;}
      setStatus('Zari voice is temporarily unavailable. The written response remains available.');return false;
    }catch(err){
      setSpeakingUi(false);console.warn('Approved Zari voice unavailable for Jivan:',err);setStatus('Zari voice could not speak this response. The written response remains available.');return false;
    }
  };

  // De-duplicate and delay the automatic post-sign-in greeting until Zari has actually finished speaking.
  scheduleSessionGreeting=function(delay=650){
    if(sessionGreetingTimer100)clearTimeout(sessionGreetingTimer100);
    sessionGreetingTimer100=setTimeout(()=>{
      sessionGreetingTimer100=null;
      const synthBusy=Boolean(window.speechSynthesis?.speaking||window.speechSynthesis?.pending);
      if(zariPrimaryBusy100()||synthBusy){scheduleSessionGreeting(420);return;}
      if(bridge?.getUser?.()){zariHandoffGreetingPending100=false;runProactive(greetingReason()).catch(()=>{});}
    },Math.max(300,Number(delay||650)));
  };

  window.addEventListener('assurance-regent-zari-primary-voice-state',e=>{
    const d=e.detail||{};if(String(d.schema||'')!==ZARI_VOICE_CONTINUITY_SCHEMA100)return;
    zariPrimaryVoiceActive100=Boolean(d.active);pendingSpeech='';
    if(zariPrimaryVoiceActive100){zariPrimaryQuietUntil100=Date.now()+90000;zariHandoffUntil=Math.max(zariHandoffUntil,Date.now()+90000);}
    else{zariPrimaryQuietUntil100=Date.now()+800;zariHandoffUntil=Math.max(zariHandoffUntil,zariPrimaryQuietUntil100);if(zariHandoffGreetingPending100&&bridge?.getUser?.())scheduleSessionGreeting(900);}
  });
  window.addEventListener('assurance-regent-agent-handoff',e=>{
    const d=e.detail||{};if(String(d.from||'').toUpperCase()!=='ZARI'||String(d.to||'').toUpperCase()!=='JIVAN')return;
    zariHandoffGreetingPending100=true;zariHandoffUntil=Math.max(zariHandoffUntil,Date.now()+(zariPrimaryVoiceActive100?90000:1200));scheduleSessionGreeting(900);
  });

  // Redirect any greeting timer that may have been scheduled before this continuity runtime loaded.
  zariHandoffUntil=Math.max(zariHandoffUntil,Date.now()+1400);pendingSpeech='';
  window.AssuranceRegentJivanVoiceBridge={schema:ZARI_VOICE_CONTINUITY_SCHEMA100,provider:'EXACT_ZARI_SIGNIN_HANDOFF_VOICE',shared:true,zariOnly:true,noAlternateFallback:true,getVoice:()=>window.AssuranceRegentZariVoice?.getVoice?.()||null};
  /* Assurance Regent v6.3.100 — uninterrupted Zari voice for Jivan END */