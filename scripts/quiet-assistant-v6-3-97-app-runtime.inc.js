  /* Assurance Regent v6.3.97 — quiet assistant + interval notifications START */
  const QUIET_ASSISTANT_SCHEMA97='6.3.97';
  const QUIET_NOTIFICATION_INTERVAL_MS97=30*60*1000;
  let quietNotificationObserved97=-1,quietNotificationPending97=0,quietNotificationItems97=[],quietNotificationTimer97=null;

  function quietNotificationCount97(){
    const c=state.control||defaultLocalControl(),u=c.profile?.currentUser;
    return u?(c.notifications||[]).filter(x=>['message','advisor','task','review','account_approval','leave_approval','recruitment_application'].includes(String(x.kind||''))).length:0;
  }
  function quietNotificationDeliveryKey97(){const u=controlUser()||{};return `assurance-regent:notification-digest:last:${String(u.id||u.email||'user').toLowerCase()}`;}
  function quietNotificationLastDelivery97(){return Number(localGet(quietNotificationDeliveryKey97())||0)||0;}
  function quietNotificationMarkDelivery97(){localSet(quietNotificationDeliveryKey97(),String(Date.now()));}
  function quietFlushNotifications97(){
    if(quietNotificationTimer97){clearTimeout(quietNotificationTimer97);quietNotificationTimer97=null;}
    if(!quietNotificationPending97||!controlUser())return;
    const count=quietNotificationPending97,items=quietNotificationItems97.slice(0,12),total=quietNotificationCount97();quietNotificationPending97=0;quietNotificationItems97=[];quietNotificationMarkDelivery97();
    window.dispatchEvent(new CustomEvent('assurance-regent-notifications-digest',{detail:{new_count:count,total_count:total,items,interval_ms:QUIET_NOTIFICATION_INTERVAL_MS97}}));
  }
  function quietScheduleNotifications97(){
    if(!quietNotificationPending97||quietNotificationTimer97||!controlUser())return;
    let last=quietNotificationLastDelivery97();if(!last){last=Date.now();quietNotificationMarkDelivery97();}
    const wait=Math.max(1000,QUIET_NOTIFICATION_INTERVAL_MS97-(Date.now()-last));quietNotificationTimer97=setTimeout(quietFlushNotifications97,wait);
  }

  const renderControlDockBase97=renderControlDock;
  renderControlDock=function(){
    const n=quietNotificationCount97(),c=state.control||defaultLocalControl(),u=c.profile?.currentUser;
    if(!u){quietNotificationObserved97=-1;quietNotificationPending97=0;quietNotificationItems97=[];if(quietNotificationTimer97){clearTimeout(quietNotificationTimer97);quietNotificationTimer97=null;}}
    else if(quietNotificationObserved97<0)quietNotificationObserved97=n;
    else{
      if(n>quietNotificationObserved97){quietNotificationPending97+=n-quietNotificationObserved97;quietNotificationItems97=(c.notifications||[]).slice(0,12);quietScheduleNotifications97();}
      quietNotificationObserved97=n;
    }
    // Prevent the legacy per-notification event from firing. The badge still updates immediately;
    // communication is delivered only through the interval digest above.
    lastAgentNotificationCount=u?n:-1;
    return renderControlDockBase97();
  };

  // Access handoff remains visible but silent. Voice authentication itself still speaks only when the user explicitly invokes it.
  announceZariHandoff=function(user=null){
    const name=String(user?.name||user?.id||'').trim();setConnectedAiOperator('JIVAN');const line=`${name?`Welcome ${name}. `:''}Access is confirmed. Jivan is available when you request a task.`;
    window.dispatchEvent(new CustomEvent('assurance-regent-agent-handoff',{detail:{from:'ZARI',to:'JIVAN',user:user||null,message:line,silent:true}}));return line;
  };

  window.addEventListener('assurance-regent-session-ended',()=>{quietNotificationObserved97=-1;quietNotificationPending97=0;quietNotificationItems97=[];if(quietNotificationTimer97){clearTimeout(quietNotificationTimer97);quietNotificationTimer97=null;}});
  /* Assurance Regent v6.3.97 — quiet assistant + interval notifications END */