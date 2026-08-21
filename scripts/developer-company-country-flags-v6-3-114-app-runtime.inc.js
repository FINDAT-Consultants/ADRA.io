  /* Assurance Regent v6.3.114 — reliable visible country flags START */
  const COMPANY_COUNTRY_FLAGS_SCHEMA114='6.3.114',COMPANY_COUNTRY_FLAG_BASE114='https://flagcdn.com/w40/';
  function countryFlagEmoji114(code=''){
    const normalized=countryCode113(code);if(!normalized)return '';
    return [...normalized].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join('');
  }
  function countryFlagUrl114(code=''){const normalized=countryCode113(code);return normalized?`${COMPANY_COUNTRY_FLAG_BASE114}${normalized.toLowerCase()}.png`:'';}
  function countryFlagVisual114(code='',name=''){
    const normalized=countryCode113(code),box=document.createElement('span');box.setAttribute('data-country-flag-visual114',normalized||'none');Object.assign(box.style,{position:'relative',width:'30px',height:'22px',display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'0 0 30px',borderRadius:'4px',overflow:'hidden',background:'#f3f7f9',boxShadow:'inset 0 0 0 1px rgba(11,43,58,.12)'});
    if(!normalized)return box;
    const fallback=document.createElement('span'),img=document.createElement('img');fallback.textContent=countryFlagEmoji114(normalized)||normalized;fallback.setAttribute('aria-hidden','true');Object.assign(fallback.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'100%',height:'100%',fontSize:'18px',lineHeight:'1'});
    img.src=countryFlagUrl114(normalized);img.alt='';img.width=30;img.height=20;img.loading='eager';img.decoding='async';img.referrerPolicy='no-referrer';Object.assign(img.style,{position:'absolute',inset:'1px 0 auto 0',display:'block',width:'30px',height:'20px',objectFit:'cover',background:'#fff'});img.addEventListener('error',()=>{img.remove();fallback.title=`${name||normalized} · ${normalized}`;},{once:true});box.append(fallback,img);return box;
  }
  countryFlagVisual113=countryFlagVisual114;
  function countryFlagRefresh114(){
    try{if($('companyProfileCountry67')){companyProfileCountrySelect112();countryPickerSync113($('companyProfileCountry67'));}document.querySelectorAll('#developerCompanyDirectory select[data-company-registered-country]').forEach(select=>{countryFlagEnhanceSelect113(select,{surface:'company-master'});countryPickerSync113(select);});}catch(err){console.warn('Country flag refresh unavailable',err);}
  }
  if(window.AssuranceRegentCompanyCountryContext)Object.assign(window.AssuranceRegentCompanyCountryContext,{schema:COMPANY_COUNTRY_FLAGS_SCHEMA114,flagSource:'flagcdn.com/w40',flagImages:true,flagFallback:'regional-indicator',forceCustomOptions:true,nativeOptionImages:false,visibleOptionFlags:true,refreshControls:countryFlagRefresh114});
  queueMicrotask(countryFlagRefresh114);window.addEventListener('assurance-regent-session-ready',()=>setTimeout(countryFlagRefresh114,120));
  /* Assurance Regent v6.3.114 — reliable visible country flags END */
