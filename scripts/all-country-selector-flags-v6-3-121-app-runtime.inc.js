  /* Assurance Regent v6.3.121 — complete country selector flags START */
  const ALL_COUNTRY_SELECTOR_FLAGS_SCHEMA121='6.3.121';
  function countryCurrencyOptionLabel121(row={}){
    const code=String(row.countryCode||'').trim().toUpperCase(),country=String(row.country||code).trim(),currency=String(row.currency||'').trim(),currencyName=String(row.currencyName||'').trim(),flag=typeof countryFlagEmoji120==='function'?countryFlagEmoji120(code):'';
    return `${flag?`${flag} `:''}${country}${currency?` — ${currency}${currencyName?` (${currencyName})`:''}`:''}`;
  }
  function flagSettingsCountryCurrency121(){
    const select=$('settingsCurrencyCountry');if(!(select instanceof HTMLSelectElement))return false;
    const rows=window.ADRA_CURRENCIES||[];let changed=false;
    for(const option of [...select.options]){
      if(!/^\d+$/u.test(String(option.value||'')))continue;
      const row=rows[Number(option.value)];if(!row?.countryCode)continue;
      const label=countryCurrencyOptionLabel121(row);if(option.textContent!==label){option.textContent=label;changed=true;}
      option.dataset.countryFlag121=typeof countryFlagEmoji120==='function'?countryFlagEmoji120(row.countryCode):'';
    }
    select.dataset.globalCountryFlags121='true';return changed;
  }
  const renderSettingsPaneBefore121=renderSettingsPane;
  renderSettingsPane=function(){const value=renderSettingsPaneBefore121();flagSettingsCountryCurrency121();if(typeof queueCountryFlagRefresh120==='function')queueCountryFlagRefresh120();return value;};
  window.addEventListener('assurance-regent-session-ready',()=>setTimeout(flagSettingsCountryCurrency121,180));
  document.addEventListener('change',event=>{if(event.target?.id==='settingsCurrencyCountry')flagSettingsCountryCurrency121();});
  queueMicrotask(flagSettingsCountryCurrency121);
  window.AssuranceRegentAllCountrySelectorFlags={schema:ALL_COUNTRY_SELECTOR_FLAGS_SCHEMA121,registeredCountrySelectors:true,countryCurrencySelector:true,nativeFlags:true,allCountryOptions:true,refresh:flagSettingsCountryCurrency121};
  /* Assurance Regent v6.3.121 — complete country selector flags END */