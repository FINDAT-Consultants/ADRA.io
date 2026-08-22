(() => {
  'use strict';

  const SCHEMA = '6.3.117';
  const SUPABASE_URL = 'https://fubqwljypdiojpbdunjc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bCscsMezuyabUbEA3gaXfw_awPFhqRq';
  const SESSION_TOKEN_KEY = 'assurance-regent-supabase-session-v460';
  const MONTHS = Object.freeze({
    jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,
    jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,
    nov:11,november:11,dec:12,december:12,
  });
  const MONTH_NAMES = Object.freeze(['January','February','March','April','May','June','July','August','September','October','November','December']);

  let stateCache = null;
  let stateCacheAt = 0;
  let stateRequest = null;
  let syncTimer = null;
  let lastFingerprint = '';
  let observer = null;

  function sessionToken(){
    try{return String(window.sessionStorage.getItem(SESSION_TOKEN_KEY)||'').trim();}catch{return '';}
  }

  async function readPersistedState(force=false){
    const token=sessionToken();
    if(!token)return null;
    const now=Date.now();
    if(!force&&stateCache&&now-stateCacheAt<12000)return stateCache;
    if(stateRequest&&!force)return stateRequest;
    stateRequest=(async()=>{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/assurance_regent_browser_read_state`,{
        method:'POST',
        headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},
        body:JSON.stringify({p_token:token}),
        cache:'no-store',
      });
      if(!response.ok)throw new Error(`Holiday key state read failed (${response.status}).`);
      const value=await response.json();
      stateCache=value&&typeof value==='object'?value:null;
      stateCacheAt=Date.now();
      return stateCache;
    })();
    try{return await stateRequest;}finally{stateRequest=null;}
  }

  function selectedMonth(host){
    const label=String(host?.querySelector('.mini-calendar-head strong')?.textContent||'').trim();
    const match=label.match(/^([A-Za-z]+)\s+(\d{4})$/u);
    if(!match)return null;
    const month=MONTHS[String(match[1]).toLowerCase()],year=Number(match[2]);
    if(!month||!Number.isInteger(year))return null;
    return {prefix:`${year}-${String(month).padStart(2,'0')}`,year,month,label:`${MONTH_NAMES[month-1]} ${year}`};
  }

  function holidayName(source=''){
    const raw=String(source||'').trim();
    if(!raw)return 'Public Holiday';
    const official=raw.match(/^Official public holiday\s*·\s*(.*?)\s*·/iu);
    let name=String(official?.[1]||raw).trim().replace(/[.]+$/u,'');
    if(/^New Year(?:'s|’s)? Day$/iu.test(name)||/^New Year Day$/iu.test(name))name='New Year';
    return name||'Public Holiday';
  }

  function holidayCountry(source=''){
    const parts=String(source||'').split('·').map(x=>x.trim()).filter(Boolean);
    return /^Official public holiday$/iu.test(parts[0]||'')?String(parts[2]||'').trim():'';
  }

  function holidayDescription(row={}){
    const raw=String(row.date||'').slice(0,10),m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
    if(!m)return `Holiday: ${holidayName(row.holidaySource)}`;
    const date=new Date(`${raw}T12:00:00`),weekday=Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-US',{weekday:'long'}),dateLabel=`${Number(m[3])} ${MONTH_NAMES[Number(m[2])-1]||m[2]}`;
    return `${weekday?`${weekday}, `:''}${dateLabel} - Holiday: ${holidayName(row.holidaySource)}`;
  }

  function monthlyHolidays(state,month){
    const rows=Array.isArray(state?.live?.calendar)?state.live.calendar:[];
    const out=[],seen=new Set();
    for(const row of rows){
      const date=String(row?.date||'').slice(0,10),dayType=String(row?.dayType||row?.day_type||'').toLowerCase();
      if(!date.startsWith(month.prefix)||!dayType.includes('holiday'))continue;
      const holidaySource=String(row?.holidaySource||row?.holiday_source||''),name=holidayName(holidaySource),key=`${date}|${name}`;
      if(seen.has(key))continue;
      seen.add(key);out.push({date,holidaySource,name,country:holidayCountry(holidaySource),description:holidayDescription({date,holidaySource})});
    }
    out.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
    return out;
  }

  function setLegendCopy(host){
    const legend=host.querySelector('.mini-calendar-legend');
    if(!legend)return null;
    const holiday=[...legend.querySelectorAll('span')].find(el=>el.querySelector('.holiday-dot'));
    if(holiday){
      [...holiday.childNodes].filter(node=>node.nodeType===3).forEach(node=>node.remove());
      let label=holiday.querySelector('[data-dashboard-holiday-key-label117]');
      if(!label){label=document.createElement('span');label.setAttribute('data-dashboard-holiday-key-label117','true');holiday.appendChild(label);}
      const legendText='Holiday — names listed below';
      if(label.textContent!==legendText)label.textContent=legendText;
      holiday.title='Holiday dates are marked with a yellow dot. The weekday, date and holiday name are listed below.';
    }
    return legend;
  }

  function makeText(tag,text,style={}){
    const el=document.createElement(tag);el.textContent=text;Object.assign(el.style,style);return el;
  }

  function renderHolidayKey(host,month,rows){
    const legend=setLegendCopy(host);
    host.querySelector('[data-dashboard-holiday-schedule116]')?.remove();
    let panel=host.querySelector('[data-dashboard-holiday-key117]');
    if(!panel){
      panel=document.createElement('section');panel.setAttribute('data-dashboard-holiday-key117','true');panel.setAttribute('aria-label','Monthly holiday key');
      Object.assign(panel.style,{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid #dce8ed'});
      if(legend)legend.insertAdjacentElement('afterend',panel);else host.appendChild(panel);
    }
    const country=rows.find(x=>x.country)?.country||'';
    const head=document.createElement('div');Object.assign(head.style,{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:'10px',marginBottom:'7px'});
    head.append(
      makeText('strong',`Holiday — ${month.label}`,{fontSize:'12px',color:'#173746'}),
      makeText('small',`${rows.length} holiday${rows.length===1?'':'s'}${country?` · ${country}`:''}`,{fontSize:'10px',color:'#708994',textAlign:'right'})
    );
    const list=document.createElement('div');list.setAttribute('data-dashboard-holiday-key-list117','true');Object.assign(list.style,{display:'grid',gap:'5px',maxHeight:'150px',overflowY:'auto',paddingRight:'3px'});
    if(!rows.length){list.appendChild(makeText('div',`No public holidays listed for ${month.label}.`,{fontSize:'11px',color:'#708994',padding:'5px 0'}));}
    for(const row of rows){
      const item=document.createElement('div'),dot=document.createElement('i'),wrap=document.createElement('span');
      item.setAttribute('data-dashboard-holiday-key-date117',row.date);Object.assign(item.style,{display:'flex',alignItems:'flex-start',gap:'8px',padding:'7px 8px',borderRadius:'8px',background:'#fffaf0',color:'#274552'});
      dot.className='holiday-dot';Object.assign(dot.style,{marginTop:'5px',flex:'0 0 auto'});
      Object.assign(wrap.style,{display:'grid',gap:'1px'});
      wrap.append(makeText('strong',row.description,{fontSize:'11px',fontWeight:'650'}),makeText('small','Official public holiday',{fontSize:'10px',color:'#7d6a42'}));
      item.append(dot,wrap);list.appendChild(item);
      const day=Number(row.date.slice(-2)),button=host.querySelector(`[data-calendar-day="${day}"]`);
      if(button){button.title=row.description;button.setAttribute('aria-label',row.description);button.dataset.holidayKey117=row.date;}
    }
    panel.replaceChildren(head,list);panel.dataset.holidayCount117=String(rows.length);panel.dataset.month117=month.prefix;
    return panel;
  }

  async function sync(force=false){
    const host=document.getElementById('dashMiniCalendar');if(!host)return false;
    const month=selectedMonth(host);if(!month)return false;
    try{
      const state=await readPersistedState(force);if(!state)return false;
      const rows=monthlyHolidays(state,month),fingerprint=`${month.prefix}|${rows.map(x=>`${x.date}:${x.name}`).join('|')}`;
      const panel=host.querySelector('[data-dashboard-holiday-key117]');
      if(!force&&fingerprint===lastFingerprint&&panel?.isConnected){setLegendCopy(host);return true;}
      renderHolidayKey(host,month,rows);lastFingerprint=fingerprint;return true;
    }catch(err){console.warn('[dashboard-holiday-key-v6.3.117]',err);return false;}
  }

  function schedule(force=false){
    if(syncTimer)clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{syncTimer=null;void sync(force);},force?40:100);
  }

  function start(){
    if(observer)return;
    observer=new MutationObserver(()=>schedule(false));
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('assurance-regent-session-ready',()=>schedule(true));
    window.addEventListener('assurance-regent-company-country-saved',()=>{stateCache=null;stateCacheAt=0;lastFingerprint='';schedule(true);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(false);});
    setInterval(()=>schedule(false),3000);
    schedule(true);
  }

  window.AssuranceRegentDashboardHolidayKey={schema:SCHEMA,source:'persisted Supabase live.calendar',selfHealing:true,format:'Weekday, D Month - Holiday: Name',refresh:()=>sync(true)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
