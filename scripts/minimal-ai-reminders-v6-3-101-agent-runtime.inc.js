  /* Assurance Regent v6.3.101 — minimal AI reminders START */
  const MINIMAL_AI_REMINDERS_SCHEMA101='6.3.101';
  const REMINDER_BREATHING_MS101=5*60*1000;
  const NOTIFICATION_COOLDOWN_MS101=20*60*1000;
  const CRITICAL_NOTIFICATION_GAP_MS101=5*60*1000;
  const CRITICAL_AFTER_SPEECH_GAP_MS101=90*1000;
  let reminderLastProactiveAt101=0,reminderLastNotificationAt101=0,reminderFlushTimer101=null,reminderDeferredTimers101=new Map(),reminderBaselineReady101=false;
  const reminderKnownNotifications101=new Set(),reminderPendingNotifications101=new Map();

  function reminderUserKey101(){const u=bridge?.getUser?.()||{};return String(u.id||u.name||'user').replace(/[^a-z0-9_.-]+/gi,'_').slice(0,80)||'user';}
  function reminderTimeKey101(type){return `assurance-regent-minimal-reminders-v101:${reminderUserKey101()}:${type}`;}
  function reminderReadTime101(type){try{return Math.max(0,Number(sessionStorage.getItem(reminderTimeKey101(type))||0));}catch{return 0;}}
  function reminderWriteTime101(type,value){try{sessionStorage.setItem(reminderTimeKey101(type),String(Math.max(0,Number(value||0))));}catch{}}
  function reminderSyncTimes101(){reminderLastProactiveAt101=reminderReadTime101('last-proactive');reminderLastNotificationAt101=reminderReadTime101('last-notification');}
  function reminderRecordSpeech101(notification=false){const now=Date.now();reminderLastProactiveAt101=now;reminderWriteTime101('last-proactive',now);if(notification){reminderLastNotificationAt101=now;reminderWriteTime101('last-notification',now);}}
  function reminderName101(){const u=bridge?.getUser?.()||{},raw=String(u.username||u.name||u.id||'').trim(),fallback=String(u.name||'').trim().split(/\s+/)[0]||'';return (/^[A-Za-z][A-Za-z0-9._-]{1,30}$/.test(raw)&&!/^EMP[-_]/i.test(raw)?raw:fallback)||'';}
  function reminderNotificationId101(item={}){const direct=item.id||item.notification_id||item.review_id||item.message_id||item.account_id||item.leave_id||item.application_id;if(direct)return String(direct);return `${String(item.kind||'notification')}|${String(item.title||'').slice(0,160)}|${String(item.detail||'').slice(0,180)}`;}
  function reminderPriority101(item={}){
    const kind=String(item.kind||'').toLowerCase(),status=String(item.status||'').toLowerCase(),text=`${kind} ${status} ${String(item.title||'')} ${String(item.detail||'')}`.toLowerCase();
    if(/\b(critical|blocked|security|breach|fraud|incident|failed|failure|overdue|exception)\b/.test(text)||status==='blocked')return 3;
    if(['review','account_approval','leave_approval'].includes(kind)||/\b(approval|approve|deadline|needs attention|required action)\b/.test(text))return 2;
    return 1;
  }
  function reminderBaseline101(){
    const notes=bridge?.getNotifications?.()||{items:[]};for(const item of (notes.items||[]))reminderKnownNotifications101.add(reminderNotificationId101(item));reminderBaselineReady101=true;
  }
  function reminderQueueNotifications101(extra={}){
    if(!reminderBaselineReady101)reminderBaseline101();
    const items=Array.isArray(extra.items)?extra.items:[],previous=Math.max(0,Number(extra.previous||0)),count=Math.max(0,Number(extra.count||0));let added=0;
    for(const item of items){const id=reminderNotificationId101(item);if(!id||reminderKnownNotifications101.has(id))continue;reminderKnownNotifications101.add(id);reminderPendingNotifications101.set(id,{...item,__priority101:reminderPriority101(item)});added++;}
    if(!added&&count>previous){const id=`count:${previous}:${count}:${Date.now()}`;reminderPendingNotifications101.set(id,{id,kind:'notification',title:'new notifications are waiting',detail:'',status:'NEW',__priority101:1});}
    return reminderPendingNotifications101.size;
  }
  function reminderTopPriority101(){let top=0;for(const item of reminderPendingNotifications101.values())top=Math.max(top,Number(item.__priority101||reminderPriority101(item)));return top;}
  function reminderNotificationDueAt101(priority=1){const now=Date.now();if(Number(priority)>=3)return Math.max(now,reminderLastProactiveAt101+CRITICAL_AFTER_SPEECH_GAP_MS101,reminderLastNotificationAt101+CRITICAL_NOTIFICATION_GAP_MS101);return Math.max(now,reminderLastProactiveAt101+REMINDER_BREATHING_MS101,reminderLastNotificationAt101+NOTIFICATION_COOLDOWN_MS101);}
  function reminderScheduleFlush101(){
    if(reminderFlushTimer101){clearTimeout(reminderFlushTimer101);reminderFlushTimer101=null;}if(!reminderPendingNotifications101.size)return;
    const wait=Math.max(0,reminderNotificationDueAt101(reminderTopPriority101())-Date.now());reminderFlushTimer101=setTimeout(()=>{reminderFlushTimer101=null;reminderFlushNotifications101().catch(()=>{});},Math.min(wait,2147483000));
  }
  function reminderNotificationText101(items=[]){
    const rows=[...items].sort((a,b)=>Number(b.__priority101||0)-Number(a.__priority101||0)),top=rows[0]||{},count=rows.length,priority=Number(top.__priority101||1),name=reminderName101(),prefix=name?`${name}, `:'';const title=String(top.title||'an update that may need your attention').replace(/\s+/g,' ').trim().slice(0,110);
    if(priority>=3)return `${prefix}a critical update needs attention: ${title}.`;
    if(count>1)return `${prefix}${count} new updates arrived. The main one is ${title}.`;
    if(priority>=2)return `${prefix}one key update needs your attention: ${title}.`;
    return `${prefix}you have a new notification: ${title}.`;
  }
  async function reminderSpeakLocal101(text='',label='Jivan'){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean||proactiveBusy||!bridge?.getUser?.())return null;proactiveBusy=true;
    try{bridge.showMessage?.(clean,label);setStatus(clean.length>150?`${clean.slice(0,147)}…`:clean);await speak(clean);reminderRecordSpeech101(label==='Jivan notification');return clean;}
    catch(err){console.warn('Minimal reminder speech unavailable:',err);return null;}finally{proactiveBusy=false;}
  }
  async function reminderFlushNotifications101(){
    if(!reminderPendingNotifications101.size||!bridge?.getUser?.())return null;const priority=reminderTopPriority101(),due=reminderNotificationDueAt101(priority);if(Date.now()<due){reminderScheduleFlush101();return null;}
    const rows=[...reminderPendingNotifications101.values()].sort((a,b)=>Number(b.__priority101||0)-Number(a.__priority101||0));const text=reminderNotificationText101(rows);reminderPendingNotifications101.clear();const spoken=await reminderSpeakLocal101(text,'Jivan notification');if(!spoken)for(const row of rows)reminderPendingNotifications101.set(reminderNotificationId101(row),row);reminderScheduleFlush101();return spoken;
  }
  function reminderGreetingText101(reason=''){
    const name=reminderName101(),who=name?`${name}, `:'';
    if(reason==='morning')return `Good morning, ${name||'there'}. I’m ready when you need me.`;
    if(reason==='midday')return `Welcome${name?`, ${name}`:''}. I’m ready when you need me.`;
    if(reason==='afternoon')return `Good afternoon${name?`, ${name}`:''}. I’m here when you need me.`;
    if(reason==='evening')return `Good evening${name?`, ${name}`:''}. I’m here if you need anything.`;
    if(reason==='lunch_return')return `Welcome back${name?`, ${name}`:''}. I’m ready when you are.`;
    if(reason==='end_day')return `Have a good evening${name?`, ${name}`:''}. I’m here if you need anything before you finish.`;
    return `${who}I’m ready when you need me.`;
  }
  function reminderDeferProactive101(reason,wait){
    if(reminderDeferredTimers101.has(reason))clearTimeout(reminderDeferredTimers101.get(reason));const timer=setTimeout(()=>{reminderDeferredTimers101.delete(reason);runProactive(reason).catch(()=>{});},Math.max(300,Number(wait||0)));reminderDeferredTimers101.set(reason,timer);
  }

  runProactive=async function(reason,extra={}){
    const why=String(reason||'welcome');if(!bridge?.getUser?.())return null;
    if(why==='notifications'){reminderQueueNotifications101(extra);reminderScheduleFlush101();return null;}
    const oneShot=['morning','midday','afternoon','evening','lunch_return','end_day'];if(oneShot.includes(why)&&proactiveDone(why))return null;
    const since=Date.now()-reminderLastProactiveAt101;if(reminderLastProactiveAt101&&since<REMINDER_BREATHING_MS101){reminderDeferProactive101(why,REMINDER_BREATHING_MS101-since+250);return null;}
    const text=reminderGreetingText101(why),spoken=await reminderSpeakLocal101(text,'Jivan');if(spoken&&oneShot.includes(why))markProactive(why);return spoken;
  };

  window.addEventListener('assurance-regent-session-ready',()=>{reminderKnownNotifications101.clear();reminderPendingNotifications101.clear();reminderBaselineReady101=false;reminderSyncTimes101();setTimeout(reminderBaseline101,180);});
  window.addEventListener('assurance-regent-session-ended',()=>{if(reminderFlushTimer101)clearTimeout(reminderFlushTimer101);reminderFlushTimer101=null;for(const timer of reminderDeferredTimers101.values())clearTimeout(timer);reminderDeferredTimers101.clear();reminderKnownNotifications101.clear();reminderPendingNotifications101.clear();reminderBaselineReady101=false;});
  reminderSyncTimes101();setTimeout(reminderBaseline101,220);
  window.AssuranceRegentReminderPolicy={schema:MINIMAL_AI_REMINDERS_SCHEMA101,mode:'PRIORITY_BATCHED',notificationCooldownMinutes:20,breathingMinutes:5,criticalGapMinutes:5,existingBacklogSpokenOnOpen:false,deduplicated:true,badgesImmediate:true,voicePath:'ZARI_APPROVED'};
  /* Assurance Regent v6.3.101 — minimal AI reminders END */