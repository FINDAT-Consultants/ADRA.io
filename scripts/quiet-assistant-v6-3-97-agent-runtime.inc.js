  /* Assurance Regent v6.3.97 — quiet explicit-invocation assistant START */
  const QUIET_AGENT_SCHEMA97='6.3.97';
  const QUIET_SPEECH_PERMIT_MS97=90*1000;
  let quietSpeechPermitUntil97=0;

  function quietTaskRequest97(text=''){
    const raw=String(text||'').trim();if(!raw)return false;
    const action=/\b(?:open|show|find|search|check|review|calculate|prepare|create|draft|write|send|email|message|schedule|remind|summari[sz]e|analy[sz]e|compare|export|upload|download|update|change|set|start|stop|run|generate|explain|tell me|give me|bring|make|do|fix|complete|submit|help me)\b/i;
    const request=/\b(?:can you|could you|would you|will you|please|i need you to|i want you to|i would like you to)\b/i;
    const information=/\b(?:what(?:'s| is| are| was| were)?|which|where|when|why|who|how much|how many|how do|how can|how should)\b/i;
    return action.test(raw)||request.test(raw)||information.test(raw);
  }
  function quietVoiceInvocation97(text=''){
    const raw=String(text||'').trim();if(!raw)return false;
    const wake=/^(?:(?:hey|hello|hi|ok|okay|please)\s+)?(?:jivan|zari)\b/i;if(!wake.test(raw))return false;
    const request=raw.replace(wake,'').replace(/^[\s,:;.!?\-]+/,'').trim();return quietTaskRequest97(request);
  }
  function quietPermitSpeech97(){quietSpeechPermitUntil97=Date.now()+QUIET_SPEECH_PERMIT_MS97;}

  const speakBase97=speak;
  speak=async function(text){
    if(Date.now()>quietSpeechPermitUntil97)return false;
    quietSpeechPermitUntil97=0;return speakBase97(text);
  };

  // No unsolicited greetings, lunch-return messages, end-of-day commentary, or notification narration.
  runProactive=async function(){return null;};
  scheduleSessionGreeting=function(){return null;};
  checkEndOfDay=function(){return null;};

  // A remembered browser microphone permission must never restart an always-listening session by itself.
  const primeRememberedMicrophoneBase97=primeRememberedMicrophone;
  primeRememberedMicrophone=async function(options={}){return primeRememberedMicrophoneBase97({...options,resumeConversation:false,autoStartGranted:false});};
  try{rememberVoiceConversation(false);}catch{}
  if(conversationMode)endVoiceConversation('Voice is available when you explicitly start it.',{rememberChoice:false});

  function quietWrapBridge97(){
    if(!bridge?.send||bridge.__quietExplicitInvocation97)return Boolean(bridge?.send);
    const sendBase=bridge.send.bind(bridge);bridge.__quietExplicitInvocation97=true;
    bridge.send=async function(text,meta={}){
      const raw=String(text||'').trim(),source=String(meta?.source||'');
      if(source==='voice-conversation'){
        if(!quietVoiceInvocation97(raw)){
          awaitingVoiceReply=false;conversationTurnBusy=false;setStatus('Ambient conversation ignored. Say “Jivan” or “Zari” and ask for a task when you want help.');if(conversationMode)scheduleConversationListen(260);return {ignored:true,reason:'explicit_invocation_required'};
        }
        quietPermitSpeech97();
      }else if(quietTaskRequest97(raw))quietPermitSpeech97();
      else quietSpeechPermitUntil97=0;
      return sendBase(text,meta);
    };
    return true;
  }

  const sendCurrentBase97=sendCurrent;
  sendCurrent=async function(){const text=String(input?.value||'').trim();if(quietTaskRequest97(text))quietPermitSpeech97();else quietSpeechPermitUntil97=0;return sendCurrentBase97();};

  const attachBridgeBase97=attachBridge;
  attachBridge=function(){const ok=attachBridgeBase97();if(ok)quietWrapBridge97();return ok;};
  quietWrapBridge97();
  window.addEventListener('assurance-regent-agent-ready',()=>setTimeout(()=>quietWrapBridge97(),0));
  window.addEventListener('assurance-regent-notifications-digest',e=>{const d=e.detail||{},count=Number(d.new_count||0);if(count>0&&bridge?.getUser?.())setStatus(`${count} new notification${count===1?'':'s'} were grouped into your Notifications centre. No spoken interruption.`);});
  /* Assurance Regent v6.3.97 — quiet explicit-invocation assistant END */