  /* Assurance Regent v6.3.112 — full Developer registered-country dropdown START */
  const COMPANY_PROFILE_COUNTRY_DROPDOWN_SCHEMA112='6.3.112';
  function companyProfileCountrySelect112(){
    if(!companyProfileDeveloper111())return false;
    const company=companyProfileById67(companyProfileEditTarget67)||{},current=$('companyProfileCountry67');if(!current)return false;
    const rows=companyProfileCountryRows111().filter(x=>/^[A-Z]{2}$/u.test(String(x.countryCode||''))).sort((a,b)=>String(a.country||'').localeCompare(String(b.country||'')));
    if(rows.length<195)return false;
    const currentMatch=companyProfileCountry111(company.registeredCountryCode||company.registeredCountry||current.value||'');
    let select=current;
    if(current.tagName!=='SELECT'){
      select=document.createElement('select');select.id='companyProfileCountry67';select.className=current.className||'';select.required=true;select.setAttribute('aria-label','Registered country');current.replaceWith(select);
    }
    select.removeAttribute('list');select.removeAttribute('readonly');select.removeAttribute('aria-readonly');select.disabled=false;select.required=true;
    select.innerHTML='<option value="">Select registered country</option>'+rows.map(x=>`<option value="${esc(x.countryCode)}">${esc(x.country)}</option>`).join('');
    const selected=String(currentMatch?.countryCode||company.registeredCountryCode||'').trim().toUpperCase();if(selected&&rows.some(x=>x.countryCode===selected))select.value=selected;
    select.dataset.fullCountryDropdown112='true';select.dataset.countryCount112=String(rows.length);
    const label=select.closest('label');if(label){let help=label.querySelector('[data-country-help112]');if(!help){help=document.createElement('small');help.setAttribute('data-country-help112','true');label.appendChild(help);}help.textContent=`Choose from ${rows.length} countries and territories.`;}
    return true;
  }
  const unlockDeveloperCompanyProfileBefore112=unlockDeveloperCompanyProfile111;
  unlockDeveloperCompanyProfile111=function(){const ok=unlockDeveloperCompanyProfileBefore112();if(ok)companyProfileCountrySelect112();return ok;};
  window.AssuranceRegentCompanyCountryDropdown={schema:COMPANY_PROFILE_COUNTRY_DROPDOWN_SCHEMA112,developerOnly:true,control:'select',source:'ADRA_CURRENCIES',minimumCountries:195,filteredDatalist:false};
  /* Assurance Regent v6.3.112 — full Developer registered-country dropdown END */
