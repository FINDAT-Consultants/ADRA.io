  /* Assurance Regent v6.3.108 — public holiday AI reminders START */
  const PUBLIC_HOLIDAY_AI_REMINDER_SCHEMA108='6.3.108';
  let publicHolidayReminderTimer108=null,publicHolidayReminderBusy108=false;
  function publicHolidayReminderUser108(){const u=bridge?.getUser?.()||{};return String(u.id||u.email||u.name||'user').replace(/[^a-z0-9_.-]+/gi,'_').slice(0,80)||'user';}
  function publicHolidayReminderBucket108(days){if(days===0)return 'today';if(days===1)return 'tomorrow';if(days<=3)return 'three-day';if(days<=7)return 'week';return '';}
  function publicHolidayReminderKey108(holiday,bucket){return `assurance-regent-holiday-reminder-v108:${publicHolidayReminderUser108()}:${holiday.countryCode}:${holiday.date}:${bucket}`;}
  function publicHolidayReminderSeen108(holiday,bucket){try{return localStorage.getItem(publicHolidayReminderKey108(holiday,bucket))==='1';}catch{return false;}}
  function publicHolidayReminderMark108(holiday,bucket){try{localStorage.setItem(publicHolidayReminderKey108(holiday,bucket),'1');}catch{}}
  function publicHolidayReminderText108(holiday){
    const name=String(holiday.name||'Public holiday'),country=String(holiday.country||holiday.countryCode||'your configured country'),days=Number(holiday.daysAway||0);
    if(days===0)return `Today is ${name}, a public holiday in ${country}. The calendar has already treated it as a non-working day.`;
    if(days===1)return `Tomorrow is ${name}, a public holiday in ${country}. The calendar has already adjusted expected working hours.`;
    if(days<=3)return `${name}, a public holiday in ${country}, is in ${days} days. The calendar has already adjusted expected working hours.`;
    return `${name}, a public holiday in ${country}, is coming up in ${days} days. It is already reflected in the calendar.`;
  }
  async function publicHolidayReminderEvaluate108(){
    if(publicHolidayReminderBusy108||!bridge?.getUser?.())return null;const api=window.ADRAHolidayCalendar;if(!api?.upcoming)return null;publicHolidayReminderBusy108=true;
    try{
      await api.ensureReminderWindow?.({quiet:true});const upcoming=api.upcoming(7)||[];
      for(const holiday of upcoming){const bucket=publicHolidayReminderBucket108(Number(holiday.daysAway));if(!bucket||publicHolidayReminderSeen108(holiday,bucket))continue;const text=publicHolidayReminderText108(holiday);bridge.showMessage?.(text,'Jivan · Public holiday');setStatus?.(`Holiday notice · ${holiday.name} · ${holiday.date}`);publicHolidayReminderMark108(holiday,bucket);window.dispatchEvent(new CustomEvent('assurance-regent-holiday-ai-reminder',{detail:{schema:PUBLIC_HOLIDAY_AI_REMINDER_SCHEMA108,text,holiday,bucket}}));return text;}
      return null;
    }catch(err){console.warn('Public holiday AI reminder unavailable:',err);return null;}finally{publicHolidayReminderBusy108=false;}
  }
  function publicHolidayReminderSchedule108(delay=900){if(publicHolidayReminderTimer108)clearTimeout(publicHolidayReminderTimer108);publicHolidayReminderTimer108=setTimeout(()=>{publicHolidayReminderTimer108=null;publicHolidayReminderEvaluate108().catch(()=>{});},Math.max(100,Number(delay||0)));}
  window.addEventListener('assurance-regent-session-ready',()=>publicHolidayReminderSchedule108(1100));
  window.addEventListener('assurance-regent-holidays-updated',e=>{if(e.detail?.changed)publicHolidayReminderSchedule108(220);});
  window.addEventListener('focus',()=>publicHolidayReminderSchedule108(400));
  window.addEventListener('assurance-regent-session-ended',()=>{if(publicHolidayReminderTimer108)clearTimeout(publicHolidayReminderTimer108);publicHolidayReminderTimer108=null;publicHolidayReminderBusy108=false;});
  setInterval(()=>{if(document.visibilityState==='visible'&&bridge?.getUser?.())publicHolidayReminderSchedule108(250);},60*60*1000);
  window.AssuranceRegentPublicHolidayReminderPolicy={schema:PUBLIC_HOLIDAY_AI_REMINDER_SCHEMA108,windowDays:7,buckets:['week','three-day','tomorrow','today'],voice:false,visualAiMessage:true,deduplicated:true,countryAware:true};
  /* Assurance Regent v6.3.108 — public holiday AI reminders END */