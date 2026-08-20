  /* Assurance Regent v6.3.108 — public holiday calendar dot markers START */
  const PUBLIC_HOLIDAY_DOT_SCHEMA108='6.3.108-dot-markers';
  const PUBLIC_HOLIDAY_DOT_STYLE_ID108='assurance-regent-public-holiday-dots-v108';

  function publicHolidayInstallDotStyles108(){
    if(document.getElementById(PUBLIC_HOLIDAY_DOT_STYLE_ID108))return;
    const style=document.createElement('style');style.id=PUBLIC_HOLIDAY_DOT_STYLE_ID108;
    style.textContent=`
      #dashMiniCalendar .calendar-day .holiday-dot,
      #dashMiniCalendar .calendar-day .public-holiday-dot108,
      #dashMiniCalendar .mini-calendar-legend .holiday-dot,
      #calendarBody .public-holiday-dot108,
      #calendarHeatmap .public-holiday-dot108{
        display:inline-block!important;width:9px!important;height:9px!important;min-width:9px!important;min-height:9px!important;
        border-radius:999px!important;background:#d92d20!important;border:1px solid rgba(255,255,255,.9)!important;
        box-shadow:0 0 0 2px rgba(217,45,32,.18)!important;vertical-align:middle!important;flex:0 0 9px!important;
      }
      #dashMiniCalendar .calendar-day.public-holiday-day108{outline:1px solid rgba(217,45,32,.28);outline-offset:-2px;}
      #dashMiniCalendar .calendar-day.public-holiday-day108>span{display:flex;align-items:center;justify-content:center;gap:3px;min-height:10px;}
      #dashMiniCalendar .mini-calendar-legend [data-public-holiday-context108]{display:block;width:100%;margin-top:4px;font-size:10px;opacity:.78;}
      #calendarBody .public-holiday-row108 td:first-child,
      #calendarBody .public-holiday-row108 td:nth-child(3){font-weight:700;}
      #calendarBody .public-holiday-label108{display:inline-flex;align-items:center;gap:6px;}
      #calendarHeatmap .public-holiday-marker108{display:flex;align-items:center;gap:6px;font-weight:700;}
    `;
    document.head.appendChild(style);
  }

  function publicHolidayEnsureDot108(container){
    if(!container)return null;let dot=container.querySelector('.holiday-dot,.public-holiday-dot108');
    if(!dot){dot=document.createElement('i');container.appendChild(dot);}dot.classList.add('holiday-dot','public-holiday-dot108');dot.setAttribute('aria-hidden','true');return dot;
  }

  function publicHolidayEnhanceDashboardDots108(){
    const host=$('dashMiniCalendar');if(!host)return;publicHolidayInstallDotStyles108();
    const prefix=String(state.month||'').slice(0,7),context=publicHolidayContext108(),rows=engine.state.calendar.filter(x=>String(x.date||'').startsWith(prefix)&&String(x.dayType||'').toLowerCase()==='holiday'),map=new Map(rows.map(row=>[Number(String(row.date).slice(-2)),row]));
    host.querySelectorAll('[data-calendar-day]').forEach(btn=>{
      const day=Number(btn.dataset.calendarDay),row=map.get(day),dotHost=btn.querySelector('span')||btn;
      if(!row){btn.classList.remove('public-holiday-day108');return;}
      const name=publicHolidayName108(row)||'Public holiday',dot=publicHolidayEnsureDot108(dotHost);btn.classList.add('public-holiday-day108');
      const label=`${prefix}-${String(day).padStart(2,'0')} — ${name}, public holiday in ${context.country} (${context.currency})`;
      btn.title=`${name} — ${context.country} (${context.currency})`;btn.setAttribute('aria-label',label);if(dot)dot.title=name;
    });
    const legend=host.querySelector('.mini-calendar-legend');if(legend){const holidayLegend=[...legend.querySelectorAll('span')].find(x=>x.querySelector('.holiday-dot')||/holiday/i.test(x.textContent||''));if(holidayLegend){publicHolidayEnsureDot108(holidayLegend);holidayLegend.lastChild&&holidayLegend.lastChild.nodeType===3&&(holidayLegend.lastChild.textContent=' Public holiday');}
      let contextLabel=legend.querySelector('[data-public-holiday-context108]');if(!contextLabel){contextLabel=document.createElement('small');contextLabel.dataset.publicHolidayContext108='true';legend.appendChild(contextLabel);}contextLabel.textContent=/^[A-Z]{2}$/.test(context.countryCode)?`Holiday calendar: ${context.country} · ${context.currency}`:'Holiday calendar follows the country configured in Settings.';
    }
  }

  function publicHolidayEnhanceCalendarDots108(){
    publicHolidayInstallDotStyles108();const all=engine.calendarAnalysis(),rows=newestFirst(all.filter(x=>x.month===state.month),['updatedAt','createdAt','date']),body=$('calendarBody'),heat=$('calendarHeatmap'),trs=body?[...body.querySelectorAll('tr:not(.empty-row)')]:[],cards=heat?[...heat.querySelectorAll('.heat-day')]:[];
    rows.forEach((row,i)=>{const holiday=String(row.dayType||'').toLowerCase()==='holiday',tr=trs[i],card=cards[i];if(!holiday){tr?.classList.remove('public-holiday-row108');return;}const name=publicHolidayName108(row)||'Public holiday';tr?.classList.add('public-holiday-row108');
      if(tr?.cells?.[2]){const cell=tr.cells[2];cell.textContent='';const label=document.createElement('span'),dot=document.createElement('i'),nameEl=document.createElement('small');label.className='public-holiday-label108';label.append(dot,document.createTextNode('Holiday'));nameEl.textContent=name;cell.append(label,document.createElement('br'),nameEl);publicHolidayEnsureDot108(label);tr.title=`${row.date} — ${name}`;}
      if(card){let marker=card.querySelector('.public-holiday-marker108,[data-public-holiday-name108]');if(!marker){marker=document.createElement('small');card.insertBefore(marker,card.children[2]||null);}marker.classList.add('public-holiday-marker108');marker.dataset.publicHolidayName108='true';marker.textContent='';const dot=document.createElement('i');marker.append(dot,document.createTextNode(name));publicHolidayEnsureDot108(marker);card.title=`${row.date} — ${name}`;}
    });
  }

  const publicHolidayDecorateDashboardBeforeDots108=publicHolidayDecorateDashboard108;
  publicHolidayDecorateDashboard108=function(){publicHolidayDecorateDashboardBeforeDots108();publicHolidayEnhanceDashboardDots108();};
  const publicHolidayDecorateCalendarBeforeDots108=publicHolidayDecorateCalendar108;
  publicHolidayDecorateCalendar108=function(){publicHolidayDecorateCalendarBeforeDots108();publicHolidayEnhanceCalendarDots108();};
  window.addEventListener('assurance-regent-holidays-updated',()=>requestAnimationFrame(()=>{publicHolidayEnhanceDashboardDots108();publicHolidayEnhanceCalendarDots108();}));
  publicHolidayInstallDotStyles108();
  window.ADRAHolidayCalendarDots={schema:PUBLIC_HOLIDAY_DOT_SCHEMA108,markerClass:'public-holiday-dot108',countryCurrencyContext:true,legend:true,tooltipName:true};
  /* Assurance Regent v6.3.108 — public holiday calendar dot markers END */