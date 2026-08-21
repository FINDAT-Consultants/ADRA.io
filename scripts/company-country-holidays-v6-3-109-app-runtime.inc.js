  /* Assurance Regent v6.3.109 — company country/currency public holiday calendar START */
  const COMPANY_HOLIDAY_SCHEMA109='6.3.109';
  const companyHolidayCache109=new Map(),companyHolidayInflight109=new Map();
  const COMPANY_HOLIDAY_CACHE_MS109=12*60*60*1000;

  function companyHolidayContext109(){
    const company=activeCompanyForView?.()||companyById?.(currentCompanyId?.())||{},settings=state.control?.settings||{},currencies=window.ADRA_CURRENCIES||[];
    const currency=String(company.operatingCurrency||company.currency||settings.currency||company.billingCurrency||'USD').trim().toUpperCase()||'USD';
    let countryCode=String(company.registeredCountryCode||company.countryCode||settings.countryCode||'').trim().toUpperCase(),countryName=String(company.registeredCountry||company.registrationCountry||company.country||settings.country||'').trim(),resolution=countryCode?(company.registeredCountryCode||company.countryCode?'company-country':'company-settings-country'):'';
    if(!countryCode&&countryName){const row=currencies.find(x=>String(x.country||'').trim().toLowerCase()===countryName.toLowerCase());if(row?.countryCode){countryCode=String(row.countryCode).toUpperCase();resolution='company-country-name';}}
    if(!countryCode&&currency){const matches=[...new Map(currencies.filter(x=>String(x.currency||'').toUpperCase()===currency&&x.countryCode).map(x=>[String(x.countryCode).toUpperCase(),x])).values()];if(matches.length===1){countryCode=String(matches[0].countryCode).toUpperCase();countryName=String(matches[0].country||countryName).trim();resolution='unique-currency-fallback';}}
    if(countryCode&&!countryName){const row=currencies.find(x=>String(x.countryCode||'').toUpperCase()===countryCode);countryName=String(row?.country||countryCode).trim();}
    return {companyId:String(company.id||currentCompanyId?.()||''),companyName:String(company.name||'Company'),countryCode,countryName,currency,resolution};
  }
  function companyHolidayYear109(){const y=Number.parseInt(String(state.month||new Date().toISOString()).slice(0,4),10);return Number.isInteger(y)&&y>=2000&&y<=2100?y:new Date().getFullYear();}
  function companyHolidayKey109(ctx,year){return `${ctx.companyId||'company'}|${ctx.countryCode}|${ctx.currency}|${year}`;}
  function decorateCompanyHolidayCalendar109(ctx=companyHolidayContext109()){
    const cards=[...document.querySelectorAll('#calendarKpis .kpi-card')],holidayCard=cards[3],hint=holidayCard?.querySelector('span');if(!hint)return;
    if(ctx.countryCode)hint.textContent=`Official holidays · ${ctx.countryName||ctx.countryCode} · ${ctx.currency}`;
    else hint.textContent=`Set the company registered country to auto-sync public holidays${ctx.currency?` · ${ctx.currency}`:''}`;
  }
  async function fetchCompanyHolidays109(ctx,year,force=false){
    const key=companyHolidayKey109(ctx,year),cached=companyHolidayCache109.get(key);if(!force&&cached&&Date.now()-cached.at<COMPANY_HOLIDAY_CACHE_MS109)return cached.value;if(companyHolidayInflight109.has(key))return companyHolidayInflight109.get(key);
    const work=(async()=>{const value=await supabaseFunction('company-holidays',{year,country_code:ctx.countryCode,currency:ctx.currency});if(!value?.ok||!Array.isArray(value.holidays))throw new Error(value?.error||'Public holiday calendar could not be loaded.');companyHolidayCache109.set(key,{at:Date.now(),value});return value;})();companyHolidayInflight109.set(key,work);try{return await work;}finally{companyHolidayInflight109.delete(key);}
  }
  async function syncCompanyHolidays109(force=false){
    if(!browserSessionToken||state.control?.profile?.signedIn===false)return false;const ctx=companyHolidayContext109();decorateCompanyHolidayCalendar109(ctx);if(!ctx.countryCode)return false;const year=companyHolidayYear109();let response;try{response=await fetchCompanyHolidays109(ctx,year,force);}catch(err){console.warn('Company public holiday sync unavailable',err);return false;}
    let changed=false;for(const holiday of response.holidays){const date=String(holiday?.date||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!date.startsWith(`${year}-`))continue;const name=String(holiday.localName||holiday.name||'Public holiday').trim()||'Public holiday',source=`Official public holiday · ${name} · ${ctx.countryName||ctx.countryCode} · Nager.Date`,existing=engine.state.calendar.find(x=>String(x.date)===date);if(existing&&String(existing.dayType)==='Holiday'&&Number(existing.standardHours||0)===0&&String(existing.holidaySource||'')===source)continue;engine.upsertCalendar({companyId:ctx.companyId||currentCompanyId(),date,dayType:'Holiday',standardHours:0,holidaySource:source});changed=true;}
    state.companyHolidayContext109={...ctx,year,source:String(response.source||'Nager.Date'),holidayCount:response.holidays.length,syncedAt:new Date().toISOString()};if(changed)persistLocalLiveState();return changed;
  }

  const renderCalendarBeforeCompanyHolidays109=renderCalendar;
  renderCalendar=function(){renderCalendarBeforeCompanyHolidays109();decorateCompanyHolidayCalendar109();syncCompanyHolidays109(false).then(changed=>{if(changed&&state.view==='calendar'){renderCalendarBeforeCompanyHolidays109();decorateCompanyHolidayCalendar109();}}).catch(()=>{});};
  async function companyHolidayRefresh109(){const changed=await syncCompanyHolidays109(true);if(changed)refreshCurrent();else if(state.view==='calendar')decorateCompanyHolidayCalendar109();return changed;}
  window.addEventListener('assurance-regent-session-ready',()=>{setTimeout(()=>syncCompanyHolidays109(false).then(changed=>{if(changed)refreshCurrent();}).catch(()=>{}),80);});
  document.addEventListener('change',e=>{if(['globalMonth','voucherMonth'].includes(e.target?.id||''))setTimeout(()=>syncCompanyHolidays109(false).then(changed=>{if(changed)refreshCurrent();}).catch(()=>{}),0);});
  window.AssuranceRegentCompanyHolidays={schema:COMPANY_HOLIDAY_SCHEMA109,countryPrimary:true,currencyFallback:'unique-only',officialHolidayStandardHours:0,source:'Nager.Date',refresh:companyHolidayRefresh109,context:companyHolidayContext109};
  /* Assurance Regent v6.3.109 — company country/currency public holiday calendar END */
