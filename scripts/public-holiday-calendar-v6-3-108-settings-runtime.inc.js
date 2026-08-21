  /* Assurance Regent v6.3.108 — public holiday country settings START */
  const PUBLIC_HOLIDAY_SETTINGS_SCHEMA108='6.3.108-holiday-country-settings';

  function publicHolidayCountryDirectory108(){
    const seen=new Map();for(const row of (window.ADRA_CURRENCIES||[])){const code=String(row?.countryCode||'').trim().toUpperCase(),country=String(row?.country||'').trim();if(/^[A-Z]{2}$/.test(code)&&country&&!seen.has(code))seen.set(code,{countryCode:code,country});}
    return [...seen.values()].sort((a,b)=>a.country.localeCompare(b.country));
  }
  function publicHolidayMainCurrencySelection108(){
    const el=$('settingsCurrencyCountry'),idx=el?.value;if(idx!==undefined&&idx!==null&&idx!==''){const row=(window.ADRA_CURRENCIES||[])[Number(idx)];if(row)return {countryCode:String(row.countryCode||'').toUpperCase(),country:String(row.country||'')};}
    const s=state.control?.settings||{};return {countryCode:String(s.countryCode||'').toUpperCase(),country:String(s.country||'')};
  }
  function publicHolidaySettingsStatus108(){
    const follow=$('settingsHolidayFollowCountry108'),select=$('settingsHolidayCountry108'),status=$('settingsHolidayCountryStatus108');if(!follow||!select||!status)return;
    if(follow.checked){const main=publicHolidayMainCurrencySelection108();if(main.countryCode)select.value=main.countryCode;select.disabled=true;status.textContent=main.countryCode?`Following organization country: ${main.country} (${main.countryCode}). Public holidays will be synchronized for this country.`:'Choose the organization country and currency above first.';}
    else{select.disabled=Boolean($('settingsCurrencyCountry')?.disabled);const row=publicHolidayCountryDirectory108().find(x=>x.countryCode===select.value);status.textContent=row?`Holiday calendar override: ${row.country} (${row.countryCode}).`:'Choose a holiday calendar country.';}
  }
  function publicHolidayInstallSettingsControl108(){
    const currencySelect=$('settingsCurrencyCountry');if(!currencySelect)return;const generalSection=currencySelect.closest('.control-settings-section');if(!generalSection)return;
    generalSection.id=generalSection.id||'settingsGeneralSection108';
    const head=generalSection.querySelector('.settings-section-head'),headTitle=head?.querySelector('b'),headNote=head?.querySelector('small');if(headTitle)headTitle.textContent='General';if(headNote)headNote.textContent='Organization country, currency and public-holiday calendar configuration.';
    let section=$('settingsHolidayCalendarSection108');
    if(!section){section=document.createElement('div');section.id='settingsHolidayCalendarSection108';section.innerHTML='<div class="settings-section-head settings-holiday-subhead108"><div><b>Public holiday calendar</b><small>Select the country whose official public holidays must appear on the operational calendar. By default this follows the organization country selected above.</small></div></div><label class="settings-holiday-follow108"><input id="settingsHolidayFollowCountry108" type="checkbox" /> Follow organization country automatically</label><label>Holiday calendar country<select id="settingsHolidayCountry108"></select></label><div class="currency-current" id="settingsHolidayCountryStatus108"></div><button type="button" class="btn small ghost" id="settingsRefreshHolidayCalendar">Refresh public holidays now</button>';}
    section.className='settings-holiday-general108';section.style.marginTop='18px';section.style.paddingTop='16px';section.style.borderTop='1px solid var(--line,#dce6eb)';if(section.parentElement!==generalSection)generalSection.appendChild(section);
    const s=state.control?.settings||{},follow=$('settingsHolidayFollowCountry108'),select=$('settingsHolidayCountry108'),directory=publicHolidayCountryDirectory108(),mode=String(s.holidayCountryMode||'follow').toLowerCase()==='override'?'override':'follow',selected=mode==='override'?(String(s.holidayCountryCode||s.countryCode||'').toUpperCase()):String(s.countryCode||s.holidayCountryCode||'').toUpperCase();
    select.innerHTML='<option value="">Choose holiday country</option>'+directory.map(x=>`<option value="${x.countryCode}">${esc(x.country)} (${x.countryCode})</option>`).join('');if(selected)select.value=selected;follow.checked=mode!=='override';
    const canEdit=!Boolean(currencySelect.disabled);follow.disabled=!canEdit;select.disabled=!canEdit||follow.checked;const refresh=$('settingsRefreshHolidayCalendar');if(refresh)refresh.disabled=!canEdit;
    if(!follow.dataset.bound108){follow.dataset.bound108='true';follow.addEventListener('change',publicHolidaySettingsStatus108);}
    if(!select.dataset.bound108){select.dataset.bound108='true';select.addEventListener('change',publicHolidaySettingsStatus108);}
    if(!currencySelect.dataset.holidayBound108){currencySelect.dataset.holidayBound108='true';currencySelect.addEventListener('change',()=>{if($('settingsHolidayFollowCountry108')?.checked)publicHolidaySettingsStatus108();});}
    publicHolidaySettingsStatus108();
  }
  function publicHolidayCaptureSettings108(){
    const follow=$('settingsHolidayFollowCountry108'),select=$('settingsHolidayCountry108');if(!follow||!select)return null;const mode=follow.checked?'follow':'override',main=publicHolidayMainCurrencySelection108(),code=mode==='follow'?main.countryCode:String(select.value||'').toUpperCase(),row=publicHolidayCountryDirectory108().find(x=>x.countryCode===code),country=mode==='follow'?(main.country||row?.country||''):(row?.country||'');return {holidayCountryMode:mode,holidayCountryCode:code,holidayCountry:country};
  }
  function publicHolidayPersistSettings108(value){
    if(!value?.holidayCountryCode)return false;if(STANDALONE_MODE){const c=localControlStore();Object.assign(c.settings,value);saveLocalControlStore(c);return true;}if(state.control?.settings){Object.assign(state.control.settings,value);return true;}return false;
  }

  const publicHolidayRenderSettingsBefore108=renderSettingsPane;
  renderSettingsPane=function(){const result=publicHolidayRenderSettingsBefore108();publicHolidayInstallSettingsControl108();return result;};
  const publicHolidaySaveSettingsBefore108=saveControlSettings;
  saveControlSettings=async function(e){
    const desired=publicHolidayCaptureSettings108(),before=publicHolidayContextKey108(),result=await publicHolidaySaveSettingsBefore108(e);if(!desired?.holidayCountryCode)return result;
    publicHolidayPersistSettings108(desired);if(STANDALONE_MODE){await refreshControlCenter();refreshCurrent();}publicHolidayInstallSettingsControl108();const after=publicHolidayContextKey108();
    if(after!==before){await publicHolidayEnsureMonth108(state.month,{force:true,quiet:true});await publicHolidayEnsureReminderWindow108({force:true});}
    toast(`Public holiday calendar: ${desired.holidayCountry}${desired.holidayCountryCode?` (${desired.holidayCountryCode})`:''}.`);return result;
  };
  document.addEventListener('click',e=>{if(!e.target?.closest?.('[data-control-panel="settings"]'))return;setTimeout(publicHolidayInstallSettingsControl108,0);},true);
  window.ADRAHolidayCalendarSettings={schema:PUBLIC_HOLIDAY_SETTINGS_SCHEMA108,install:publicHolidayInstallSettingsControl108,capture:publicHolidayCaptureSettings108,followOrganizationCountry:true,overrideSupported:true,generalSection:true};
  /* Assurance Regent v6.3.108 — public holiday country settings END */