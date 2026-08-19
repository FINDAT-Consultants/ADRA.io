  /* Assurance Regent v6.3.98 — exact Zari sign-in voice bridge START */
  const ZARI_SHARED_VOICE_SCHEMA98='6.3.98-exact-signin';
  const zariSignInSpeakBase98=speakAuthPrompt;

  function zariSharedSpeak98(text='',options={}){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(!clean||!window.speechSynthesis||typeof zariSignInSpeakBase98!=='function')return Promise.resolve(false);
    const channel=String(options.channel||'ZARI').toUpperCase();
    return new Promise(resolve=>{
      let settled=false,started=false;
      const synth=window.speechSynthesis,startAt=Date.now(),maxWait=Math.max(2500,Math.min(90000,1200+clean.length*85));
      const finish=(ok)=>{if(settled)return;settled=true;clearInterval(timer);window.dispatchEvent(new CustomEvent('assurance-regent-zari-voice-state',{detail:{active:false,channel,provider:'EXACT_SIGNIN_HANDOFF',schema:ZARI_SHARED_VOICE_SCHEMA98}}));resolve(Boolean(ok));};
      const timer=setInterval(()=>{
        const active=Boolean(synth.speaking||synth.pending);if(active)started=true;
        if(started&&!active)return finish(true);
        if(!started&&Date.now()-startAt>700&&!active)return finish(true);
        if(Date.now()-startAt>maxWait)return finish(false);
      },60);
      try{
        // This is the exact function Zari already uses for sign-up, sign-in and the "Over to Jivan" handoff.
        // Do not select, replace or tune a separate voice here.
        zariSignInSpeakBase98(clean);
        started=Boolean(synth.speaking||synth.pending);
        window.dispatchEvent(new CustomEvent('assurance-regent-zari-voice-state',{detail:{active:true,channel,provider:'EXACT_SIGNIN_HANDOFF',schema:ZARI_SHARED_VOICE_SCHEMA98}}));
      }catch{finish(false);}
    });
  }

  window.AssuranceRegentZariVoice={schema:ZARI_SHARED_VOICE_SCHEMA98,provider:'EXACT_SIGNIN_HANDOFF',speak:(text,options={})=>zariSharedSpeak98(text,options),stop:()=>{try{window.speechSynthesis?.cancel?.();}catch{}},getVoice:()=>({mode:'browser-default-via-zari-signin',explicitVoiceSelection:false})};
  /* Assurance Regent v6.3.98 — exact Zari sign-in voice bridge END */