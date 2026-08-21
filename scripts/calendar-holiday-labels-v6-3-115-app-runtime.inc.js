  /* Assurance Regent v6.3.115 — human-readable calendar holiday labels START */
  const CALENDAR_HOLIDAY_LABEL_SCHEMA115='6.3.115',CALENDAR_HOLIDAY_LABEL_EXAMPLE115='1 January - Holiday: New Year';
  const CALENDAR_MONTH_NAMES115=['January','February','March','April','May','June','July','August','September','October','November','December'];
  let calendarHolidayLabelObserver115=null,calendarHolidayLabelScheduled115=false;
  function calendarHolidayDateLabel115(value=''){
    const raw=String(value||'').trim(),match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/u);if(!match)return raw;
    const month=CALENDAR_MONTH_NAMES115[Number(match[2])-1],day=Number(match[3]);return month&&day?`${day} ${month}`:raw;
  }
  function calendarHolidayName115(source=''){
    const raw=String(source||'').trim();if(!raw)return 'Public Holiday';
    const described=raw.match(/^\d{1,2}\s+[\p{L}.'-]+(?:\s+[\p{L}.'-]+)*\s+-\s+Holiday:\s*(.+)$/iu);if(described?.[1])return calendarHolidayNormalizeName115(described[1]);
    const official=raw.match(/^Official public holiday\s*·\s*(.*?)\s*·\s*.*?\s*·\s*Nager\.Date$/iu);return calendarHolidayNormalizeName115(official?.[1]||raw);
  }
  function calendarHolidayNormalizeName115(value=''){
    let name=String(value||'').trim().replace(/\s+/gu,' ').replace(/[.]+$/u,'');
    if(/^New Year(?:'s|’s)? Day$/iu.test(name)||/^New Year Day$/iu.test(name))name='New Year';
    return name||'Public Holiday';
  }
  function calendarHolidayDescription115(date='',source=''){return `${calendarHolidayDateLabel115(date)} - Holiday: ${calendarHolidayName115(source)}`;}
  function calendarHolidayRows115(){try{return newestFirst(engine.calendarAnalysis().filter(x=>x.month===state.month),['updatedAt','createdAt','date']);}catch{return [];}}
  function decorateCalendarHolidayLabels115(){
    const body=$('calendarBody');if(body){for(const tr of body.querySelectorAll('tr')){const cells=tr.querySelectorAll('td');if(cells.length<8||String(cells[2].textContent||'').trim()!=='Holiday')continue;const date=String(cells[0].textContent||'').trim(),cell=cells[7],technical=cell.dataset.holidayTechnicalSource115||String(cell.textContent||'').trim(),description=calendarHolidayDescription115(date,technical);if(!cell.dataset.holidayTechnicalSource115)cell.dataset.holidayTechnicalSource115=technical;if(cell.textContent!==description)cell.textContent=description;cell.dataset.holidayDescription115=description;if(technical)cell.title=technical;}}
    const heatmap=$('calendarHeatmap'),rows=calendarHolidayRows115();if(heatmap&&rows.length){const cards=[...heatmap.querySelectorAll('.heat-day')];for(let i=0;i<cards.length;i++){const row=rows[i],card=cards[i];if(!row||String(row.dayType)!=='Holiday'||!card)continue;let label=card.querySelector('[data-holiday-description115]');if(!label){label=document.createElement('small');label.setAttribute('data-holiday-description115','true');card.appendChild(label);}label.textContent=calendarHolidayDescription115(row.date,row.holidaySource||'');label.title=String(row.holidaySource||'');}}
  }
  function scheduleCalendarHolidayLabels115(){if(calendarHolidayLabelScheduled115)return;calendarHolidayLabelScheduled115=true;queueMicrotask(()=>{calendarHolidayLabelScheduled115=false;decorateCalendarHolidayLabels115();observeCalendarHolidayLabels115();});}
  function observeCalendarHolidayLabels115(){const body=$('calendarBody');if(!body||body.dataset.holidayLabelObserved115==='true')return;body.dataset.holidayLabelObserved115='true';calendarHolidayLabelObserver115=new MutationObserver(scheduleCalendarHolidayLabels115);calendarHolidayLabelObserver115.observe(body,{childList:true,subtree:true});}
  const renderCalendarBeforeHolidayLabels115=renderCalendar;
  renderCalendar=function(){const value=renderCalendarBeforeHolidayLabels115();decorateCalendarHolidayLabels115();observeCalendarHolidayLabels115();return value;};
  window.addEventListener('assurance-regent-session-ready',()=>setTimeout(scheduleCalendarHolidayLabels115,160));
  window.AssuranceRegentHolidayLabels={schema:CALENDAR_HOLIDAY_LABEL_SCHEMA115,format:'D Month - Holiday: Name',example:CALENDAR_HOLIDAY_LABEL_EXAMPLE115,technicalMetadataPreserved:true,formatDate:calendarHolidayDateLabel115,formatName:calendarHolidayName115,describe:calendarHolidayDescription115,refresh:scheduleCalendarHolidayLabels115};
  queueMicrotask(scheduleCalendarHolidayLabels115);
  /* Assurance Regent v6.3.115 — human-readable calendar holiday labels END */
