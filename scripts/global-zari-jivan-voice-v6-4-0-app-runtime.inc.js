  /* Assurance Regent v6.4.0 — global canonical Zari/Jivan voice START */
  const GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640='6.4.0';
  const GLOBAL_ZARI_JIVAN_VOICE_NAME640='coral';
  const GLOBAL_ZARI_JIVAN_VOICE_SPEED640=1;
  let globalVoiceAudio640=null,globalVoiceUrl640='',globalVoiceRun640=0;

  function globalVoiceStop640(){
    globalVoiceRun640++;
    try{if(globalVoiceAudio640){globalVoiceAudio640.pause();globalVoiceAudio640.currentTime=0;}}catch{}
    globalVoiceAudio640=null;
    if(globalVoiceUrl640){try{URL.revokeObjectURL(globalVoiceUrl640);}catch{}globalVoiceUrl640='';}
  }
  function globalVoiceBase64Blob640(base64,mime='audio/mpeg'){
    const raw=atob(String(base64||'')),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:mime});
  }
  async function globalVoiceFetch640(text='',agent='ZARI'){
    const clean=String(text||'').replace(/\s+/g,' ').trim().slice(0,4096);if(!clean)throw new Error('Speech text is empty.');
    const who=String(agent||'ZARI').toUpperCase()==='JIVAN'?'JIVAN':'ZARI';
    if(browserSessionToken){
      const r=await managedFetch(`${SUPABASE_URL}/functions/v1/jivan-voice`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({session_token:browserSessionToken,agent:who,text:clean})},{timeout:95000,retries:0});
      if(!r.ok){const t=await r.text().catch(()=>'');let e=t;try{e=JSON.parse(t)?.error||t;}catch{}throw new Error(e||`Global voice failed (${r.status}).`);}return r.blob();
    }
    const out=await publicSupabaseFunction('zari-public-voice',{text:clean.slice(0,700)});
    if(!out?.audio_base64)throw new Error(out?.error||'Zari global voice did not return audio.');
    return globalVoiceBase64Blob640(out.audio_base64,out.mime_type||'audio/mpeg');
  }
  async function globalVoiceSpeak640(text='',options={}){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return false;
    const agent=String(options.agent||options.channel||'ZARI').toUpperCase()==='JIVAN'?'JIVAN':'ZARI';
    globalVoiceStop640();const activeRun=++globalVoiceRun640;
    const blob=await globalVoiceFetch640(clean,agent);if(activeRun!==globalVoiceRun640)return false;
    globalVoiceUrl640=URL.createObjectURL(blob);const audio=new Audio(globalVoiceUrl640);globalVoiceAudio640=audio;audio.preload='auto';
    return new Promise((resolve,reject)=>{
      const finish=(ok,err=null)=>{if(audio===globalVoiceAudio640)globalVoiceAudio640=null;if(globalVoiceUrl640){try{URL.revokeObjectURL(globalVoiceUrl640);}catch{}globalVoiceUrl640='';}window.dispatchEvent(new CustomEvent('assurance-regent-global-voice-state',{detail:{active:false,agent,voice:GLOBAL_ZARI_JIVAN_VOICE_NAME640,speed:GLOBAL_ZARI_JIVAN_VOICE_SPEED640,schema:GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640}}));if(err)reject(err);else resolve(Boolean(ok));};
      audio.onplay=()=>window.dispatchEvent(new CustomEvent('assurance-regent-global-voice-state',{detail:{active:true,agent,voice:GLOBAL_ZARI_JIVAN_VOICE_NAME640,speed:GLOBAL_ZARI_JIVAN_VOICE_SPEED640,schema:GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640}}));
      audio.onended=()=>finish(true);audio.onerror=()=>finish(false,new Error('Canonical voice audio could not be played.'));
      Promise.resolve(audio.play()).catch(err=>finish(false,err));
    });
  }

  const speakAuthPromptBase640=speakAuthPrompt;
  speakAuthPrompt=function(text=''){
    const clean=String(text||'').trim();if(!clean)return;
    globalVoiceSpeak640(clean,{agent:'ZARI'}).catch(()=>{try{speakAuthPromptBase640(clean);}catch{}});
  };

  window.AssuranceRegentCanonicalVoice={schema:GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640,provider:'OPENAI_SERVER_TTS',voice:GLOBAL_ZARI_JIVAN_VOICE_NAME640,speed:GLOBAL_ZARI_JIVAN_VOICE_SPEED640,global:true,speak:(text,options={})=>globalVoiceSpeak640(text,options),stop:globalVoiceStop640,getVoice:()=>({name:GLOBAL_ZARI_JIVAN_VOICE_NAME640,speed:GLOBAL_ZARI_JIVAN_VOICE_SPEED640,provider:'OPENAI_SERVER_TTS',global:true})};
  window.AssuranceRegentZariVoice=window.AssuranceRegentCanonicalVoice;
  /* Assurance Regent v6.4.0 — global canonical Zari/Jivan voice END */