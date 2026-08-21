  /* Assurance Regent v6.3.108 — country public holiday calendar + AI reminder feed START */
  const PUBLIC_HOLIDAY_CALENDAR_SCHEMA108='6.3.108';
  const PUBLIC_HOLIDAY_API108='https://date.nager.at/api/v4/Holidays';
  const PUBLIC_HOLIDAY_SOURCE_PREFIX108='ADRA-PUBLIC-HOLIDAY-V108|';
  const PUBLIC_HOLIDAY_CACHE_TTL108=24*60*60*1000;
  const publicHolidayPending108=new Map();
  let publicHolidayRenderGuard108=false;

  function publicHolidayContext108(){
    const s=state.control?.settings||{},mode=String(s.holidayCountryMode||'follow').toLowerCase()==='override'?'override':'follow',organizationCode=String(s.countryCode||'').trim().toUpperCase(),configuredHolidayCode=String(s.holidayCountryCode||'').trim().toUpperCase(),countryCode=mode==='override'?(configuredHolidayCode||organizationCode):(organizationCode||configuredHolidayCode),configuredCountry=String(s.holidayCountry||'').trim(),directoryCountry=(window.ADRA_CURRENCIES||[]).find(x=>String(x.countryCode||'').toUpperCase()===countryCode)?.country||'';
    const country=mode==='override'?(configuredCountry||directoryCountry||String(s.country||'').trim()||'Configured country'):(String(s.country||'').trim()||directoryCountry||configuredCountry||'Configured country');
    return {countryCode,country,currency:String(s.currency||'').trim().toUpperCase()||'USD',holidayCountryMode:mode,organizationCountryCode:organizationCode,organizationCountry:String(s.country||'').trim()||'Not configured'};
  }
  function publicHolidayContextKey108(){const c=publicHolidayContext108();return `${c.countryCode}|${c.currency}`;}
  function publicHolidayCacheKey108(countryCode,year){return `assurance-regent-public-holidays-v108:${countryCode}:${year}`;}
  function publicHolidayReadCache108(countryCode,year){
    try{const raw=localStorage.getItem(publicHolidayCacheKey108(countryCode,year));if(!raw)return null;const parsed=JSON.parse(raw);return parsed&&Array.isArray(parsed.items)?parsed:null;}catch{return null;}
  }
  function publicHolidayWriteCache108(countryCode,year,items){try{localStorage.setItem(publicHolidayCacheKey108(countryCode,year),JSON.stringify({at:Date.now(),items}));}catch{}}
  function publicHolidayNormalize108(item,countryCode){
    const date=String(item?.date||'').slice(0,10),name=String(item?.name||item?.localName||'Public holiday').trim(),types=Array.isArray(item?.holidayTypes)?item.holidayTypes:Array.isArray(item?.types)?item.types:[];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!name)return null;
    if(types.length&&!types.some(x=>String(x).toLowerCase()==='public'))return null;
    if(item?.nationalHoliday===false||item?.global===false)return null;
    return {date,name,countryCode:String(item?.countryCode||countryCode||'').toUpperCase()};
  }
  function publicHolidayMergeSameDate108(items=[]){
    const map=new Map();for(const item of items){const prior=map.get(item.date);if(!prior){map.set(item.date,{...item});continue;}const names=new Set(String(prior.name||'').split(' / ').concat(String(item.name||'')).map(x=>x.trim()).filter(Boolean));prior.name=[...names].join(' / ');}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  }
  async function publicHolidayFetchYear108(year,{force=false}={}){
    const {countryCode}=publicHolidayContext108(),y=Number(year),cached=publicHolidayReadCache108(countryCode,y);
    if(!/^[A-Z]{2}$/.test(countryCode)||!Number.isInteger(y))return {ok:false,items:[],cached:false,reason:'country-not-configured'};
    if(!force&&cached&&Date.now()-Number(cached.at||0)<PUBLIC_HOLIDAY_CACHE_TTL108)return {ok:true,items:cached.items,cached:true};
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const res=await fetch(`${PUBLIC_HOLIDAY_API108}/${encodeURIComponent(countryCode)}/${y}`,{headers:{accept:'application/json'},signal:controller.signal});
      if(!res.ok)throw new Error(`Holiday service returned ${res.status}.`);
      const body=await res.json(),normalized=(Array.isArray(body)?body:[]).map(x=>publicHolidayNormalize108(x,countryCode)).filter(Boolean),items=publicHolidayMergeSameDate108(normalized);
      publicHolidayWriteCache108(countryCode,y,items);return {ok:true,items,cached:false};
    }catch(err){
      if(cached)return {ok:true,items:cached.items,cached:true,stale:true,reason:err?.message||'cached-fallback'};
      console.warn('Public holiday sync unavailable:',err);return {ok:false,items:[],cached:false,reason:err?.message||'holiday-service-unavailable'};
    }finally{clearTimeout(timer);}
  }
  function publicHolidayEncode108(value){try{return encodeURIComponent(JSON.stringify(value));}catch{return encodeURIComponent('{"exists":false}');}}
  function publicHolidayDecode108(value){try{return JSON.parse(String(value||''));}catch{try{return JSON.parse(decodeURIComponent(value||''));}catch{return {exists:false};}}}
  function publicHolidayParseSource108(source=''){
    const raw=String(source||'');if(!raw.startsWith(PUBLIC_HOLIDAY_SOURCE_PREFIX108))return null;const out={};for(const part of raw.slice(PUBLIC_HOLIDAY_SOURCE_PREFIX108.length).split('|')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i)]=decodeURIComponent(part.slice(i+1));}out.prev=publicHolidayDecode108(out.prev||'');return out;
  }
  function publicHolidayPreviousSnapshot108(row){return row?{exists:true,dayType:row.dayType||'Working Day',standardHours:Number(row.standardHours||0),holidaySource:String(row.holidaySource||'')}:{exists:false};}
  function publicHolidayManagedSource108(holiday,context,previous){return `${PUBLIC_HOLIDAY_SOURCE_PREFIX108}cc=${encodeURIComponent(context.countryCode)}|cur=${encodeURIComponent(context.currency)}|name=${encodeURIComponent(holiday.name)}|prev=${publicHolidayEncode108(previous)}`;}
  function publicHolidayName108(row){const meta=publicHolidayParseSource108(row?.holidaySource);if(meta?.name)return meta.name;return String(row?.dayType||'').toLowerCase()==='holiday'?String(row?.holidaySource||'').trim():'';}
  function publicHolidayRestoreRow108(row){
    const meta=publicHolidayParseSource108(row?.holidaySource);if(!meta)return false;const prev=meta.prev||{exists:false};
    if(prev.exists){engine.upsertCalendar({companyId:row.companyId||currentCompanyId(),date:row.date,dayType:prev.dayType||'Working Day',standardHours:Number(prev.standardHours||0),holidaySource:String(prev.holidaySource||'')});}
    else engine.state.calendar=engine.state.calendar.filter(x=>x!==row&&String(x.date)!==String(row.date));
    return true;
  }
  function publicHolidayRestoreForeign108(context){let changed=false;for(const row of [...engine.state.calendar]){const meta=publicHolidayParseSource108(row.holidaySource);if(meta&&meta.cc&&meta.cc!==context.countryCode)changed=publicHolidayRestoreRow108(row)||changed;}return changed;}
  function publicHolidayRestoreRemoved108(context,year,activeDates){let changed=false;for(const row of [...engine.state.calendar]){const meta=publicHolidayParseSource108(row.holidaySource);if(meta?.cc===context.countryCode&&String(row.date||'').startsWith(`${year}-`)&&!activeDates.has(row.date))changed=publicHolidayRestoreRow108(row)||changed;}return changed;}
  function publicHolidayApply108(holiday,context){
    const existing=engine.state.calendar.find(x=>String(x.date)===holiday.date),meta=publicHolidayParseSource108(existing?.holidaySource),previous=meta?.cc===context.countryCode?(meta.prev||{exists:false}):publicHolidayPreviousSnapshot108(existing),source=publicHolidayManagedSource108(holiday,context,previous);
    if(existing&&existing.dayType==='Holiday'&&Number(existing.standardHours)===0&&existing.holidaySource===source)return false;
    engine.upsertCalendar({companyId:existing?.companyId||currentCompanyId(),date:holiday.date,dayType:'Holiday',standardHours:0,holidaySource:source});return true;
  }
  function publicHolidayRefreshViews108(){
    publicHolidayRenderGuard108=true;try{typeof renderAll==='function'?renderAll():(originalRenderCalendar108(),publicHolidayDecorateCalendar108());}finally{publicHolidayRenderGuard108=false;}
  }
  async function publicHolidaySyncYear108(year,{force=false,quiet=true}={}){
    const context=publicHolidayContext108(),y=Number(year),key=`${context.countryCode}:${y}:${force?'force':'normal'}`;
    if(!/^[A-Z]{2}$/.test(context.countryCode)||!Number.isInteger(y))return {ok:false,items:[],reason:'country-not-configured'};
    if(publicHolidayPending108.has(key))return publicHolidayPending108.get(key);
    const job=(async()=>{
      let changed=publicHolidayRestoreForeign108(context),result=await publicHolidayFetchYear108(y,{force});
      if(result.ok){const active=new Set(result.items.map(x=>x.date));changed=publicHolidayRestoreRemoved108(context,y,active)||changed;for(const holiday of result.items)changed=publicHolidayApply108(holiday,context)||changed;if(changed){persistLocalLiveState();publicHolidayRefreshViews108();}}
      window.dispatchEvent(new CustomEvent('assurance-regent-holidays-updated',{detail:{schema:PUBLIC_HOLIDAY_CALENDAR_SCHEMA108,year:y,context,holidays:result.items||[],ok:Boolean(result.ok),cached:Boolean(result.cached),stale:Boolean(result.stale),changed}}));
      if(!quiet){if(result.ok)toast(`${result.items.length} ${context.country} public holidays synchronized for ${y}.`);else toast('Public holiday service is unavailable; existing calendar data was kept.');}
      return {...result,changed,context,year:y};
    })().finally(()=>publicHolidayPending108.delete(key));publicHolidayPending108.set(key,job);return job;
  }
  function publicHolidayYearFromMonth108(month=state.month){const y=Number(String(month||'').slice(0,4));return Number.isInteger(y)&&y>1900?y:new Date().getFullYear();}
  function publicHolidayEnsureMonth108(month=state.month,options={}){return publicHolidaySyncYear108(publicHolidayYearFromMonth108(month),options);}
  async function publicHolidayEnsureReminderWindow108(options={}){const now=new Date(),year=now.getFullYear(),results=[await publicHolidaySyncYear108(year,{...options,quiet:true})];if(now.getMonth()>=10)results.push(await publicHolidaySyncYear108(year+1,{...options,quiet:true}));return results;}
  function publicHolidayDateDiff108(date){const today=new Date();today.setHours(0,0,0,0);const target=new Date(`${date}T00:00:00`);target.setHours(0,0,0,0);return Math.round((target-today)/86400000);}
  function publicHolidayUpcoming108(days=7){
    const context=publicHolidayContext108(),max=Math.max(0,Number(days||7));return engine.state.calendar.map(row=>({row,meta:publicHolidayParseSource108(row.holidaySource)})).filter(x=>x.meta?.cc===context.countryCode).map(x=>({date:x.row.date,name:x.meta.name||'Public holiday',countryCode:context.countryCode,country:context.country,currency:context.currency,daysAway:publicHolidayDateDiff108(x.row.date)})).filter(x=>x.daysAway>=0&&x.daysAway<=max).sort((a,b)=>a.daysAway-b.daysAway||a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  }
  function publicHolidayDecorateCalendar108(){
    const all=engine.calendarAnalysis(),rows=newestFirst(all.filter(x=>x.month===state.month),['updatedAt','createdAt','date']),body=$('calendarBody'),heat=$('calendarHeatmap');
    const trs=body?[...body.querySelectorAll('tr:not(.empty-row)')]:[],cards=heat?[...heat.querySelectorAll('.heat-day')]:[];
    rows.forEach((row,i)=>{if(String(row.dayType||'').toLowerCase()!=='holiday')return;const name=publicHolidayName108(row);if(!name)return;const meta=publicHolidayParseSource108(row.holidaySource),ctx=publicHolidayContext108(),sourceLabel=meta?`${name} · ${ctx.country} (${ctx.currency}) · Official public holiday`:name,tr=trs[i];if(tr?.cells?.[2])tr.cells[2].innerHTML=`Holiday<br><small>${esc(name)}</small>`;if(tr?.cells?.[7])tr.cells[7].textContent=sourceLabel;const card=cards[i];if(card&&!card.querySelector('[data-public-holiday-name108]')){const tag=document.createElement('small');tag.dataset.publicHolidayName108='true';tag.textContent=`🎉 ${name}`;card.insertBefore(tag,card.children[2]||null);}});
  }
  function publicHolidayDecorateDashboard108(){
    const host=$('dashMiniCalendar');if(!host)return;const prefix=String(state.month||'').slice(0,7),map=new Map(engine.state.calendar.filter(x=>String(x.date||'').startsWith(prefix)&&String(x.dayType||'').toLowerCase()==='holiday').map(x=>[Number(String(x.date).slice(-2)),publicHolidayName108(x)]));
    host.querySelectorAll('[data-calendar-day]').forEach(btn=>{const day=Number(btn.dataset.calendarDay),name=map.get(day);if(name){btn.title=name;btn.setAttribute('aria-label',`${prefix}-${String(day).padStart(2,'0')} — ${name} public holiday`);}});
  }

  const originalRenderCalendar108=renderCalendar;
  renderCalendar=function(){originalRenderCalendar108();publicHolidayDecorateCalendar108();if(!publicHolidayRenderGuard108)publicHolidayEnsureMonth108(state.month,{quiet:true}).catch(()=>{});};
  const originalRenderDashboardCalendar108=renderDashboardCalendar;
  renderDashboardCalendar=function(monthRows){originalRenderDashboardCalendar108(monthRows);publicHolidayDecorateDashboard108();if(!publicHolidayRenderGuard108)publicHolidayEnsureMonth108(state.month,{quiet:true}).catch(()=>{});};
  const originalSaveControlSettings108=saveControlSettings;
  saveControlSettings=async function(e){const before=publicHolidayContextKey108(),result=await originalSaveControlSettings108(e),after=publicHolidayContextKey108();if(after!==before){await publicHolidayEnsureMonth108(state.month,{force:true,quiet:true});await publicHolidayEnsureReminderWindow108({force:true});}return result;};

  document.addEventListener('click',e=>{const target=e.target?.closest?.('[data-refresh-holidays],#refreshHolidayCalendar,#settingsRefreshHolidayCalendar');if(!target)return;e.preventDefault();publicHolidayEnsureMonth108(state.month,{force:true,quiet:false}).catch(()=>toast('Could not refresh the public holiday calendar.'));},true);
  window.addEventListener('assurance-regent-session-ready',()=>setTimeout(()=>publicHolidayEnsureReminderWindow108({quiet:true}).catch(()=>{}),650));
  window.addEventListener('assurance-regent-holiday-ai-reminder',e=>{const text=String(e.detail?.text||'').trim();if(text)toast(`Jivan: ${text}`);});
  window.ADRAHolidayCalendar={schema:PUBLIC_HOLIDAY_CALENDAR_SCHEMA108,provider:'Nager.Date Community API v4',context:publicHolidayContext108,syncYear:publicHolidaySyncYear108,ensureMonth:publicHolidayEnsureMonth108,ensureReminderWindow:publicHolidayEnsureReminderWindow108,upcoming:publicHolidayUpcoming108,nameForDate:(date)=>publicHolidayName108(engine.state.calendar.find(x=>String(x.date)===String(date)))};
  /* Assurance Regent v6.3.108 — country public holiday calendar + AI reminder feed END */