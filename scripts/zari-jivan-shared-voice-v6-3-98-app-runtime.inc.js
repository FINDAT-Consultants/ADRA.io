  /* Assurance Regent v6.3.98 — shared Zari/Jivan synthetic voice START */
  const ZARI_SHARED_VOICE_SCHEMA98='6.3.98';
  let zariSharedVoiceCache98=null;

  function resolveZariSharedVoice98(){
    const voices=window.speechSynthesis?.getVoices?.()||[];
    if(zariSharedVoiceCache98&&voices.includes(zariSharedVoiceCache98))return zariSharedVoiceCache98;
    const english=voices.filter(v=>/^en([-_]|$)/i.test(String(v.lang||'')));
    zariSharedVoiceCache98=english.find(v=>v.default)||voices.find(v=>v.default)||english[0]||voices[0]||null;
    return zariSharedVoiceCache98;
  }

  function zariSharedSpeak98(text='',options={}){
    const clean=String(text||'').replace(/\s+/g,' ').trim();
    if(!clean||!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return Promise.resolve(false);
    const channel=String(options.channel||'ZARI').toUpperCase(),interrupt=options.interrupt!==false;
    return new Promise(resolve=>{
      let settled=false;
      const finish=(ok)=>{if(settled)return;settled=true;window.dispatchEvent(new CustomEvent('assurance-regent-zari-voice-state',{detail:{active:false,channel,voice:resolveZariSharedVoice98()?.name||'',schema:ZARI_SHARED_VOICE_SCHEMA98}}));resolve(Boolean(ok));};
      try{
        if(interrupt)window.speechSynthesis.cancel();
        const utterance=new SpeechSynthesisUtterance(clean),voice=resolveZariSharedVoice98();
        if(voice){utterance.voice=voice;utterance.lang=voice.lang||'en-US';}
        utterance.rate=1;utterance.pitch=1;utterance.volume=.9;
        utterance.onstart=()=>window.dispatchEvent(new CustomEvent('assurance-regent-zari-voice-state',{detail:{active:true,channel,voice:voice?.name||'',schema:ZARI_SHARED_VOICE_SCHEMA98}}));
        utterance.onend=()=>finish(true);utterance.onerror=()=>finish(false);
        window.speechSynthesis.speak(utterance);
      }catch{finish(false);}
    });
  }

  const speakAuthPromptBase98=speakAuthPrompt;
  speakAuthPrompt=function(text=''){
    const clean=String(text||'').trim();if(!clean)return;
    zariSharedSpeak98(clean,{channel:'ZARI',interrupt:true}).then(ok=>{if(!ok){try{speakAuthPromptBase98(clean);}catch{}}}).catch(()=>{try{speakAuthPromptBase98(clean);}catch{}});
  };

  if('speechSynthesis' in window)window.speechSynthesis.addEventListener?.('voiceschanged',()=>{zariSharedVoiceCache98=null;});
  window.AssuranceRegentZariVoice={schema:ZARI_SHARED_VOICE_SCHEMA98,speak:(text,options={})=>zariSharedSpeak98(text,options),stop:()=>{try{window.speechSynthesis?.cancel?.();}catch{}},getVoice:()=>{const v=resolveZariSharedVoice98();return v?{name:v.name||'',lang:v.lang||'',default:Boolean(v.default)}:null;}};
  /* Assurance Regent v6.3.98 — shared Zari/Jivan synthetic voice END */