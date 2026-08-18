  /* Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START */
  function ensureCreateCompanySinglePageStyles83(){
    if($('createCompanySinglePageStyles83'))return;
    const style=document.createElement('style');style.id='createCompanySinglePageStyles83';
    style.textContent=`
      .developer-company-profile-row83{display:grid!important;grid-template-columns:auto minmax(0,1fr) minmax(240px,320px);align-items:center;gap:24px}
      .developer-company-currency83{display:grid;gap:7px;align-self:center;min-width:0}
      .developer-company-currency83>b{font-size:13px;color:inherit}
      .developer-company-currency83>small{font-size:11px;line-height:1.35;opacity:.72}
      .developer-company-currency83 select{width:100%;min-height:42px}
      @media(max-width:820px){.developer-company-profile-row83{grid-template-columns:auto 1fr}.developer-company-currency83{grid-column:1/-1;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function developerCompanyCurrencyRows83(){
    const seen=new Set(),rows=[];
    for(const row of (window.ADRA_CURRENCIES||[])){
      const code=String(row?.currency||'').trim().toUpperCase();if(!code||seen.has(code))continue;
      seen.add(code);rows.push(row);
    }
    return rows.sort((a,b)=>String(a.currency||'').localeCompare(String(b.currency||'')));
  }

  function developerCompanyCurrencyOptions83(selected=''){
    return '<option value="">Select currency</option>'+developerCompanyCurrencyRows83().map((row,index)=>`<option value="${index}" ${String(index)===String(selected)?'selected':''}>${esc(row.currency)} — ${esc(row.currencyName||row.currency)}</option>`).join('');
  }

  function developerCompanyCurrencyRow83(){
    const value=$('newCompanyCurrencyCountry82')?.value??'';return value===''?null:developerCompanyCurrencyRows83()[Number(value)]||null;
  }

  developerCompanyCreateDialog66=function(){
    let dialog=$('developerCompanyCreateDialog66');
    if(dialog?.dataset?.singlePageCurrency83==='1')return dialog;
    if(dialog)dialog.remove();
    dialog=document.createElement('dialog');dialog.id='developerCompanyCreateDialog66';dialog.className='developer-company-create-dialog66';dialog.dataset.singlePageCurrency83='1';
    dialog.innerHTML=`<form id="developerCompanyCreateForm66" novalidate>
      <header class="developer-company-create-head66"><div><small>Developer company directory</small><h2>Create Company</h2><p>Create the organization profile and choose its operating currency.</p></div><button type="button" class="developer-company-create-close66" data-developer-company-create-close66 aria-label="Close Create Company">×</button></header>
      <div class="developer-company-create-body66">
        <div class="developer-company-profile-row66 developer-company-profile-row83">
          <div class="developer-company-logo-preview66" data-developer-company-logo-preview66>Company<br/>logo</div>
          <div class="developer-company-logo-upload66"><b>Company profile image</b><small>Optional. Upload the company logo or profile image used on its directory card and inside the company workspace.</small><label><span>＋</span> Choose logo<input id="newCompanyLogo66" type="file" accept="image/*" /></label></div>
          <label class="developer-company-currency83"><b>Currency</b><small>Select the currency this company will use.</small><select id="newCompanyCurrencyCountry82" required>${developerCompanyCurrencyOptions83('')}</select></label>
        </div>
        <div class="developer-company-create-grid66">
          <label>Company name<input id="newCompanyName" autocomplete="organization" required /></label>
          <label>Company code<input id="newCompanyCode" autocomplete="off" maxlength="24" required /></label>
          <label>Company email<input id="newCompanyEmail66" type="email" autocomplete="email" placeholder="company@example.com" /></label>
          <label>Contact number<input id="newCompanyPhone66" type="tel" autocomplete="tel" placeholder="+260 ..." /></label>
          <label class="span-2">Google Meet interview room<input id="newCompanyMeetUrl" type="url" inputmode="url" placeholder="https://meet.google.com/abc-defg-hij" autocomplete="off" required /><span class="field-note66">This dedicated room is used by the organization for HR and candidate interviews.</span></label>
        </div>
      </div>
      <footer class="developer-company-create-foot66"><button type="button" class="developer-company-create-cancel66" data-developer-company-create-close66>Cancel</button><button type="button" class="developer-company-create-submit66" data-developer-company-create-submit66>Submit</button></footer>
    </form>`;
    document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();if(!developerCompanyCreateBusy66)dialog.close();});return dialog;
  };

  openDeveloperCompanyCreate66=function(){
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    ensureCreateCompanySinglePageStyles83();const dialog=developerCompanyCreateDialog66(),form=$('developerCompanyCreateForm66');form?.reset();
    const currency=$('newCompanyCurrencyCountry82');if(currency)currency.innerHTML=developerCompanyCurrencyOptions83('');
    if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}
    const preview=dialog.querySelector('[data-developer-company-logo-preview66]');if(preview)preview.innerHTML='Company<br/>logo';
    developerCompanyCreateBusy66=false;const submit=dialog.querySelector('[data-developer-company-create-submit66]');if(submit){submit.disabled=false;submit.textContent='Submit';}
    if(!dialog.open)dialog.showModal();setTimeout(()=>$('newCompanyName')?.focus(),0);
  };

  createDeveloperCompany66=async function(){
    if(developerCompanyCreateBusy66)return;
    const name=$('newCompanyName')?.value.trim()||'',code=$('newCompanyCode')?.value.trim().toUpperCase()||'',currencyRow=developerCompanyCurrencyRow83(),meetUrl=normalizeGoogleMeetUrl($('newCompanyMeetUrl')?.value||''),email=$('newCompanyEmail66')?.value.trim()||'',phone=$('newCompanyPhone66')?.value.trim()||'',logoFile=$('newCompanyLogo66')?.files?.[0]||null;
    if(!name||!code||!currencyRow||!meetUrl)return toast('Enter the company details, select a currency, and provide a valid Google Meet interview room.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return toast('Enter a valid company email address.');
    if(logoFile&&!String(logoFile.type||'').toLowerCase().startsWith('image/'))return toast('The company profile image must be an image file.');
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    const auth=previewAuthData();if(auth.companies.some(c=>String(c.code||'').toUpperCase()===code))return toast('Company code already exists.');if(auth.companies.some(c=>normalizeGoogleMeetUrl(c.interviewMeetUrl)===meetUrl))return toast('That Google Meet room is already assigned to another company.');
    const companyId=`COMP-${crypto.randomUUID()}`,submit=$('developerCompanyCreateDialog66')?.querySelector('[data-developer-company-create-submit66]');
    developerCompanyCreateBusy66=true;if(submit){submit.disabled=true;submit.textContent='Submitting…';}
    let logoWarning='';
    try{
      auth.companies.push({id:companyId,name,code,contactEmail:email,email,contactPhone:phone,phone,currency:currencyRow.currency,currencyName:currencyRow.currencyName,interviewMeetUrl:meetUrl,active:true,systemEnabled:true,monthlyAmount:0,billingCurrency:currencyRow.currency,billingCurrencyName:currencyRow.currencyName,paymentAccount:'',billingMessage:'',createdAt:new Date().toISOString(),createdBy:controlActorId()});
      savePreviewAuthData(auth);await queueStandaloneSave();await loadStandaloneState();
      if(logoFile){
        try{const stored=await uploadPersistentFile(logoFile,{category:'company-logo',companyId,entityType:'company',entityId:companyId,metadata:{companyName:name,companyCode:code}});if(stored?.fileId){const next=previewAuthData(),created=next.companies.find(c=>String(c.id)===companyId);if(created){created.logoFileId=stored.fileId;created.companyLogoFileId=stored.fileId;savePreviewAuthData(next);await queueStandaloneSave();await loadStandaloneState();}}}catch(err){logoWarning=` Company created, but its logo could not be stored: ${err?.message||err}`;}
      }
      await refreshControlCenter();developerCompanySelectorSearch63='';developerCompanySelectorPage63=Math.floor(Math.max(0,developerCompanyRows63().findIndex(c=>String(c.id)===companyId))/DEVELOPER_COMPANY_SELECTOR_PAGE_SIZE63);developerCompanySelectorOpen63=true;
      const dialog=$('developerCompanyCreateDialog66');if(dialog?.open)dialog.close();developerCompanyCreateBusy66=false;renderCompany();toast(`Company created with ${currencyRow.currency} as its currency.${logoWarning}`);
    }catch(err){developerCompanyCreateBusy66=false;if(submit){submit.disabled=false;submit.textContent='Submit';}toast(err?.message||String(err));}
  };

  ensureCreateCompanySinglePageStyles83();
  /* Assurance Regent v6.3.83 — single-page Developer Create Company currency selection END */
