  /* Assurance Regent v6.3.108 — authoritative yellow public-holiday date markers START */
  const PUBLIC_HOLIDAY_DATE_MARKER_FIX108='6.3.108-yellow-date-binding';
  const publicHolidayUiPayload108=new Map();

  function publicHolidayUiKey108(countryCode,year){return `${String(countryCode||'').toUpperCase()}:${Number(year)}`;}
  function publicHolidayProviderRows108(prefix,context){
    const year=Number(String(prefix||'').slice(0,4)),key=publicHolidayUiKey108(context.countryCode,year),live=publicHolidayUiPayload108.get(key),cached=publicHolidayReadCache108(context.countryCode,year),items=Array.isArray(live)?live:Array.isArray(cached?.items)?cached.items:[];
    return items.filter(item=>String(item?.date||'').startsWith(prefix)).map(item=>({date:String(item.date).slice(0,10),dayType:'Holiday',standardHours:0,holidaySource:String(item.name||'Public holiday')}));
  }
  function publicHolidayAuthoritativeRows108(prefix,context){
    const map=new Map();
    engine.state.calendar.filter(row=>String(row.date||'').startsWith(prefix)&&String(row.dayType||'').toLowerCase()==='holiday').forEach(row=>map.set(String(row.date),row));
    publicHolidayProviderRows108(prefix,context).forEach(row=>map.set(String(row.date),row));
    return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function publicHolidayInstallYellowMarkerStyle108(){
    if(document.getElementById('assurance-regent-yellow-holiday-date-fix-v108'))return;
    const style=document.createElement('style');style.id='assurance-regent-yellow-holiday-date-fix-v108';style.textContent=`
      #dashMiniCalendar .calendar-day .holiday-dot,
      #dashMiniCalendar .calendar-day .public-holiday-dot108,
      #dashMiniCalendar .mini-calendar-legend .holiday-dot,
      #dashMiniCalendar [data-public-holiday-details108] .public-holiday-dot108,
      #calendarBody .public-holiday-dot108,
      #calendarHeatmap .public-holiday-dot108{
        background:#f1b329!important;border-color:#fff8de!important;box-shadow:0 0 0 2px rgba(241,179,41,.22)!important;
      }
      #dashMiniCalendar .calendar-day.public-holiday-day108{outline-color:rgba(241,179,41,.48)!important;}
    `;document.head.appendChild(style);
  }
  function publicHolidayPaintAuthoritativeDateDots108(){
    const host=$('dashMiniCalendar');if(!host)return;publicHolidayInstallYellowMarkerStyle108();
    const prefix=String(state.month||'').slice(0,7),context=publicHolidayContext108(),rows=publicHolidayAuthoritativeRows108(prefix,context),byDay=new Map(rows.map(row=>[Number(String(row.date).slice(-2)),row]));
    host.querySelectorAll('[data-calendar-day]').forEach(btn=>{
      const dotHost=btn.querySelector('span')||btn;dotHost.querySelectorAll('.holiday-dot,.public-holiday-dot108').forEach(dot=>dot.remove());btn.classList.remove('public-holiday-day108');
      const day=Number(btn.dataset.calendarDay),row=byDay.get(day);if(!row)return;
      const name=publicHolidayName108(row)||String(row.holidaySource||'Public holiday'),dot=document.createElement('i');dot.className='holiday-dot public-holiday-dot108';dot.setAttribute('aria-hidden','true');dot.title=name;dotHost.appendChild(dot);btn.classList.add('public-holiday-day108');
      btn.title=`${name} — ${context.country} (${context.currency})`;btn.setAttribute('aria-label',`${prefix}-${String(day).padStart(2,'0')} — ${name}, public holiday in ${context.country} (${context.currency})`);
    });
    publicHolidayRenderMonthlyNames108(host,rows,context);
  }

  const publicHolidayEnhanceDashboardDotsBeforeDateFix108=publicHolidayEnhanceDashboardDots108;
  publicHolidayEnhanceDashboardDots108=function(){publicHolidayEnhanceDashboardDotsBeforeDateFix108();publicHolidayPaintAuthoritativeDateDots108();};
  window.addEventListener('assurance-regent-holidays-updated',e=>{
    const detail=e.detail||{},cc=String(detail.context?.countryCode||'').toUpperCase(),year=Number(detail.year);if(detail.ok&&cc&&Number.isInteger(year)&&Array.isArray(detail.holidays))publicHolidayUiPayload108.set(publicHolidayUiKey108(cc,year),detail.holidays);
    requestAnimationFrame(publicHolidayPaintAuthoritativeDateDots108);
  });
  publicHolidayInstallYellowMarkerStyle108();
  if(window.ADRAHolidayCalendarDots)Object.assign(window.ADRAHolidayCalendarDots,{dateMarkerFix:PUBLIC_HOLIDAY_DATE_MARKER_FIX108,authoritativeDateBinding:true,yellowMarker:true,providerDatasetFallback:true});
  /* Assurance Regent v6.3.108 — authoritative yellow public-holiday date markers END */