  /* Assurance Regent v6.3.120 — global country flags and company holiday calendar START */
  const GLOBAL_COUNTRY_HOLIDAY_SCHEMA120='6.3.120';
  const GLOBAL_HOLIDAY_CACHE_MS120=6*60*60*1000;
  const globalHolidayCache120=new Map(),globalHolidayInflight120=new Map();
  let globalCountryObserver120=null,globalCountryRefreshQueued120=false;

  function countryRows120(){
    const rows=[],seen=new Set();
    for(const row of (window.ADRA_CURRENCIES||[])){
      const code=String(row?.countryCode||'').trim().toUpperCase(),name=String(row?.country||'').trim();
      if(!name||!code||seen.has(code))continue;seen.add(code);rows.push({code,name,row});
    }
    return rows.sort((a,b)=>a.name.localeCompare(b.name));
  }
  function countryFlagEmoji120(code=''){
    const c=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/u.test(c))return '🏳️';
    try{return [...c].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('');}catch{return '🏳️';}
  }
  function countryOptionLabel120(code,name){return `${countryFlagEmoji120(code)} ${String(name||code).trim()}`.trim();}
  companyCountryOptions=function(selected=''){
    const wanted=String(selected||'').trim().toUpperCase();
    return '<option value="">Select country</option>'+countryRows120().map(x=>`<option value="${esc(x.code)}" ${wanted===x.code?'selected':''}>${esc(countryOptionLabel120(x.code,x.name))}</option>`).join('');
  };
  function countrySelectorLooksGlobal120(select){
    if(!(select instanceof HTMLSelectElement))return false;
    if(['newCompanyCountry','companyProfileCountry67','companyExecutiveCountry'].includes(select.id))return true;
    if(select.matches('[data-company-registered-country]'))return true;
    const codes=new Set(countryRows120().map(x=>x.code));
    const opts=[...select.options].filter(o=>String(o.value||'').trim());
    const matches=opts.filter(o=>codes.has(String(o.value||'').trim().toUpperCase())).length;
    return matches>=20&&matches>=Math.min(opts.length,Math.ceil(opts.length*.7));
  }
  function ensureCountryOptionFlags120(select){
    if(!(select instanceof HTMLSelectElement)||!countrySelectorLooksGlobal120(select))return false;
    const byCode=new Map(countryRows120().map(x=>[x.code,x]));
    let changed=false;
    for(const option of [...select.options]){
      const code=String(option.value||'').trim().toUpperCase(),row=byCode.get(code);if(!row)continue;
      const label=countryOptionLabel120(code,row.name);
      if(option.textContent!==label){option.textContent=label;changed=true;}
      option.dataset.countryFlag120=countryFlagEmoji120(code);
    }
    select.dataset.globalCountryFlags120='true';
    return changed;
  }
  function enhanceCountrySelect120(select){
    if(!countrySelectorLooksGlobal120(select))return false;
    ensureCountryOptionFlags120(select);
    try{
      if(typeof countryFlagEnhanceSelect113==='function'&&!select.dataset.countryFlagEnhanced120){
        countryFlagEnhanceSelect113(select,{surface:'global-country'});
        select.dataset.countryFlagEnhanced120='true';
      }
    }catch(err){console.warn('Country flag picker enhancement skipped',err);}
    return true;
  }
  function refreshCountryFlags120(root=document){
    const selects=[];
    if(root instanceof HTMLSelectElement)selects.push(root);
    if(root?.querySelectorAll)selects.push(...root.querySelectorAll('select'));
    let count=0;for(const select of selects)if(enhanceCountrySelect120(select))count+=1;
    return count;
  }
  function queueCountryFlagRefresh120(){
    if(globalCountryRefreshQueued120)return;globalCountryRefreshQueued120=true;
    queueMicrotask(()=>{globalCountryRefreshQueued120=false;refreshCountryFlags120(document);});
  }
  function observeCountrySelectors120(){
    if(globalCountryObserver120)return;
    globalCountryObserver120=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='childList'&&record.addedNodes.length){queueCountryFlagRefresh120();break;}
      }
    });
    globalCountryObserver120.observe(document.documentElement,{childList:true,subtree:true});
  }

  function companyMatch120(row={},companyId=''){
    const cid=String(companyId||'').trim(),rowCid=String(row?.companyId||'').trim();
    if(!cid)return true;if(rowCid)return rowCid===cid;
    const companies=previewAuthData?.()?.companies||[];
    return companies.length<=1;
  }
  function calendarDate120(value=''){const m=String(value||'').trim().match(/^(\d{4}-\d{2}-\d{2})/u);return m?.[1]||'';}
  function calendarMonth120(date=''){const d=calendarDate120(date);return d?`${d.slice(0,7)}-01`:'';}
  function calendarDay120(date=''){const d=calendarDate120(date);if(!d)return '';return new Date(`${d}T00:00:00Z`).toLocaleDateString('en',{weekday:'short',timeZone:'UTC'});}
  function upsertCalendarCompanyScoped120(value={}){
    const date=calendarDate120(value.date);if(!date)throw new Error('Calendar date is required.');
    const companyId=String(value.companyId||currentCompanyId?.()||'COMPANY-DEFAULT').trim()||'COMPANY-DEFAULT',rows=engine.state.calendar||[];
    const index=rows.findIndex(x=>calendarDate120(x.date)===date&&companyMatch120(x,companyId)),existing=index>=0?rows[index]:{};
    const row={...existing,...value,companyId,date,month:calendarMonth120(date),day:value.day??existing.day??calendarDay120(date),dayType:value.dayType??existing.dayType??'Working Day',standardHours:Number(value.standardHours??existing.standardHours??0),holidaySource:String(value.holidaySource??existing.holidaySource??'').trim(),createdAt:existing.createdAt||value.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(index>=0)rows[index]=row;else rows.push(row);
    return row;
  }
  engine.upsertCalendar=upsertCalendarCompanyScoped120;

  const calendarAnalysisBefore120=engine.calendarAnalysis.bind(engine);
  engine.calendarAnalysis=function(){
    const companyId=String(currentCompanyId?.()||'').trim(),base=calendarAnalysisBefore120().filter(x=>companyMatch120(x,companyId));
    return base.map(day=>{
      const rows=(engine.state.timeEntries||[]).filter(x=>String(x.date||'')===String(day.date||'')&&companyMatch120(x,companyId)&&String(x.status||'').trim().toLowerCase()==='finance approved');
      const recordedHours=rows.reduce((sum,x)=>sum+Number(x.hours||0),0),variance=recordedHours-Number(day.standardHours||0),dailyStatus=Math.abs(variance)<.01||(Number(day.standardHours||0)===0&&recordedHours===0)?'PASS':'REVIEW';
      return {...day,recordedHours:Number(recordedHours.toFixed(8)),variance:Number(variance.toFixed(8)),dailyStatus};
    });
  };

  function holidayTechnicalName120(source=''){
    const raw=String(source||'').trim();if(!raw)return 'Public Holiday';
    const official=raw.match(/^Official public holiday\s*·\s*(.*?)\s*·/iu);
    const described=raw.match(/^\d{1,2}\s+[\p{L}.'-]+(?:\s+[\p{L}.'-]+)*\s+-\s+Holiday:\s*(.+)$/iu);
    return String(official?.[1]||described?.[1]||raw||'Public Holiday').replace(/^New Year(?:'s|’s)? Day$/iu,'New Year').trim()||'Public Holiday';
  }
  if(typeof calendarHolidayName115==='function')calendarHolidayName115=holidayTechnicalName120;
  if(typeof dashboardHolidayName116==='function')dashboardHolidayName116=holidayTechnicalName120;

  function systemHoliday120(row={}){
    return Boolean(row.holidayManaged120)||/^Official public holiday\s*·/iu.test(String(row.holidaySource||''));
  }
  function holidayProvider120(response={}){
    const providers=Array.isArray(response.providers)?response.providers.filter(Boolean):[];
    return String(providers.join('+')||response.source||'date-holidays').trim();
  }
  function holidayName120(holiday={}){
    return String(holiday.localName||holiday.name||'Public Holiday').trim()||'Public Holiday';
  }
  function globalHolidayKey120(ctx,year){return `${ctx.companyId||'company'}|${ctx.countryCode}|${year}`;}
  async function fetchGlobalCompanyHolidays120(ctx,year,force=false){
    const key=globalHolidayKey120(ctx,year),cached=globalHolidayCache120.get(key);
    if(!force&&cached&&Date.now()-cached.at<GLOBAL_HOLIDAY_CACHE_MS120)return cached.value;
    if(globalHolidayInflight120.has(key))return globalHolidayInflight120.get(key);
    const task=(async()=>{
      const value=await supabaseFunction('company-holidays',{year,country_code:ctx.countryCode,currency:ctx.currency});
      if(!value?.ok||!Array.isArray(value.holidays))throw new Error(value?.error||'Company public holidays could not be loaded.');
      globalHolidayCache120.set(key,{at:Date.now(),value});return value;
    })();
    globalHolidayInflight120.set(key,task);try{return await task;}finally{globalHolidayInflight120.delete(key);}
  }
  fetchCompanyHolidays109=fetchGlobalCompanyHolidays120;

  async function syncGlobalCompanyHolidays120(force=false){
    if(!browserSessionToken||state.control?.profile?.signedIn===false)return false;
    const ctx=companyHolidayContext109(),year=companyHolidayYear109();decorateCompanyHolidayCalendar109(ctx);
    if(!ctx.countryCode)return false;
    let response;try{response=await fetchGlobalCompanyHolidays120(ctx,year,force);}catch(err){console.warn('Global company holiday sync unavailable',err);return false;}
    const companyId=String(ctx.companyId||currentCompanyId?.()||'').trim(),wanted=new Map();
    for(const holiday of response.holidays||[]){
      const date=calendarDate120(holiday?.date);if(!date||!date.startsWith(`${year}-`))continue;
      wanted.set(date,holiday);
    }
    let changed=false;
    for(let i=(engine.state.calendar||[]).length-1;i>=0;i--){
      const row=engine.state.calendar[i],date=calendarDate120(row?.date);
      if(!companyMatch120(row,companyId)||!date.startsWith(`${year}-`)||!systemHoliday120(row)||wanted.has(date))continue;
      if(row.holidayBaseline120&&typeof row.holidayBaseline120==='object'){
        const baseline=row.holidayBaseline120;
        engine.state.calendar[i]={...row,dayType:String(baseline.dayType||'Working Day'),standardHours:Number(baseline.standardHours||0),holidaySource:String(baseline.holidaySource||''),holidayManaged120:false,holidayCountryCode120:'',holidayProvider120:'',holidayBaseline120:null,updatedAt:new Date().toISOString()};
      }else engine.state.calendar.splice(i,1);
      changed=true;
    }
    const provider=holidayProvider120(response);
    for(const [date,holiday] of wanted){
      const name=holidayName120(holiday),source=`Official public holiday · ${name} · ${ctx.countryName||ctx.countryCode} · ${provider}`;
      const existing=(engine.state.calendar||[]).find(x=>calendarDate120(x.date)===date&&companyMatch120(x,companyId));
      const baseline=existing?.holidayBaseline120||(existing&&!systemHoliday120(existing)?{dayType:existing.dayType,standardHours:Number(existing.standardHours||0),holidaySource:String(existing.holidaySource||'')}:null);
      const same=existing&&String(existing.dayType)==='Holiday'&&Number(existing.standardHours||0)===0&&String(existing.holidaySource||'')===source&&String(existing.holidayCountryCode120||ctx.countryCode)===String(ctx.countryCode);
      if(same)continue;
      upsertCalendarCompanyScoped120({...(existing||{}),companyId,date,dayType:'Holiday',standardHours:0,holidaySource:source,holidayManaged120:true,holidayCountryCode120:ctx.countryCode,holidayProvider120:provider,holidayNames120:Array.isArray(holiday.names)?holiday.names:[name],holidayBaseline120:baseline});
      changed=true;
    }
    state.companyHolidayContext109={...ctx,year,source:String(response.source||provider),providers:Array.isArray(response.providers)?response.providers:[provider],coverage:response.coverage||null,holidayCount:wanted.size,syncedAt:new Date().toISOString()};
    if(changed)persistLocalLiveState();
    window.dispatchEvent(new CustomEvent('assurance-regent-global-holidays-synced',{detail:{schema:GLOBAL_COUNTRY_HOLIDAY_SCHEMA120,companyId,countryCode:ctx.countryCode,year,holidayCount:wanted.size,provider}}));
    return changed;
  }
  syncCompanyHolidays109=syncGlobalCompanyHolidays120;
  companyHolidayRefresh109=async function(){const changed=await syncGlobalCompanyHolidays120(true);if(changed)refreshCurrent();else{if(state.view==='calendar')renderCalendar();if(state.view==='dashboard'&&typeof refreshDashboardHolidayDescriptions116==='function')refreshDashboardHolidayDescriptions116();}return changed;};

  if(typeof dashboardHolidayRows116==='function')dashboardHolidayRows116=function(){
    const prefix=String(state.month||'').slice(0,7),companyId=String(currentCompanyId?.()||'').trim(),rows=(engine?.state?.calendar||[]).filter(x=>companyMatch120(x,companyId)&&String(x.date||'').startsWith(prefix)&&String(x.dayType||'').toLowerCase().includes('holiday')).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))),seen=new Set(),out=[];
    for(const row of rows){const description=dashboardHolidayDescription116(row),key=`${String(row.date||'')}|${description}`;if(seen.has(key))continue;seen.add(key);out.push({...row,description,holidayName:holidayTechnicalName120(row.holidaySource||'')});}
    return out;
  };

  const renderDashboardCalendarBefore120=renderDashboardCalendar;
  renderDashboardCalendar=function(monthRows){
    const value=renderDashboardCalendarBefore120(monthRows),host=$('dashMiniCalendar');if(!host)return value;
    host.querySelectorAll('.calendar-day .holiday-dot').forEach(x=>x.remove());
    const rows=typeof dashboardHolidayRows116==='function'?dashboardHolidayRows116():[];
    for(const row of rows){
      const day=Number(String(row.date||'').slice(-2)),button=host.querySelector(`[data-calendar-day="${day}"]`);if(!button)continue;
      const marks=button.querySelector('span')||button.appendChild(document.createElement('span')),dot=document.createElement('i');dot.className='holiday-dot';marks.appendChild(dot);
      const description=typeof dashboardHolidayDescription116==='function'?dashboardHolidayDescription116(row):`${row.date} - Holiday: ${holidayTechnicalName120(row.holidaySource||'')}`;
      button.dataset.holidayDescription120=description;button.title=description;button.setAttribute('aria-label',description);
    }
    if(typeof decorateDashboardHolidays116==='function')decorateDashboardHolidays116();
    return value;
  };

  function refreshGlobalHolidayUi120(){
    queueCountryFlagRefresh120();
    if(state.view==='calendar'){renderCalendar();if(typeof scheduleCalendarHolidayLabels115==='function')scheduleCalendarHolidayLabels115();}
    if(state.view==='dashboard'&&typeof refreshDashboardHolidayDescriptions116==='function')refreshDashboardHolidayDescriptions116();
  }
  window.addEventListener('assurance-regent-session-ready',()=>{setTimeout(()=>{queueCountryFlagRefresh120();syncGlobalCompanyHolidays120(false).then(()=>refreshGlobalHolidayUi120()).catch(()=>{});},220);});
  window.addEventListener('assurance-regent-company-country-saved',()=>{globalHolidayCache120.clear();setTimeout(()=>syncGlobalCompanyHolidays120(true).then(()=>refreshGlobalHolidayUi120()).catch(()=>{}),80);});
  document.addEventListener('change',event=>{const select=event.target;if(select instanceof HTMLSelectElement&&countrySelectorLooksGlobal120(select))ensureCountryOptionFlags120(select);});
  observeCountrySelectors120();queueCountryFlagRefresh120();

  window.AssuranceRegentGlobalCountryHolidays={
    schema:GLOBAL_COUNTRY_HOLIDAY_SCHEMA120,
    flags:{nativeEmoji:true,customFlagPicker:true,allCountrySelectors:true,imageSource:'flagcdn.com',emojiFallback:true},
    holidays:{primary:'date-holidays',primaryCountryCoverage:206,fallback:'Nager.Date',nationalPublicOnly:true,multipleNamesPerDate:true,companyScoped:true,staleSystemHolidayReconciliation:true,yellowDotNames:true},
    refreshFlags:()=>refreshCountryFlags120(document),
    refreshHolidays:()=>companyHolidayRefresh109()
  };
  /* Assurance Regent v6.3.120 — global country flags and company holiday calendar END */