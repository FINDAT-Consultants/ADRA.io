  /* Assurance Regent v6.3.66 — Developer Companies directory creation hub START */
  let developerCompanyCreateBusy66=false,developerCompanyLogoPreviewUrl66='';

  function developerCompanyCreateDialog66(){
    let dialog=$('developerCompanyCreateDialog66');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='developerCompanyCreateDialog66';
    dialog.className='developer-company-create-dialog66';
    dialog.innerHTML=`<form id="developerCompanyCreateForm66" novalidate>
      <header class="developer-company-create-head66"><div><small>Developer company directory</small><h2>Create Company</h2><p>Create the organization profile here. Its dedicated workspace card will be added to the Companies directory automatically.</p></div><button type="button" class="developer-company-create-close66" data-developer-company-create-close66 aria-label="Close Create Company">×</button></header>
      <div class="developer-company-create-body66">
        <div class="developer-company-profile-row66"><div class="developer-company-logo-preview66" data-developer-company-logo-preview66>Company<br/>logo</div><div class="developer-company-logo-upload66"><b>Company profile image</b><small>Optional. Upload the company logo or profile image used on its directory card and inside the company workspace.</small><label><span>＋</span> Choose logo<input id="newCompanyLogo66" type="file" accept="image/*" /></label></div></div>
        <div class="developer-company-create-grid66">
          <label>Company name<input id="newCompanyName" autocomplete="organization" required /></label>
          <label>Company code<input id="newCompanyCode" autocomplete="off" maxlength="24" required /></label>
          <label>Company email<input id="newCompanyEmail66" type="email" autocomplete="email" placeholder="company@example.com" /></label>
          <label>Contact number<input id="newCompanyPhone66" type="tel" autocomplete="tel" placeholder="+260 ..." /></label>
          <label>Registered country<select id="newCompanyCountry" required><option value="">Select country</option>${companyCountryOptions('')}</select></label>
          <label>Google Meet interview room<input id="newCompanyMeetUrl" type="url" inputmode="url" placeholder="https://meet.google.com/abc-defg-hij" autocomplete="off" required /><span class="field-note66">This dedicated room is used by the organization for HR and candidate interviews.</span></label>
        </div>
      </div>
      <footer class="developer-company-create-foot66"><button type="button" class="developer-company-create-cancel66" data-developer-company-create-close66>Cancel</button><button type="button" class="developer-company-create-submit66" data-developer-company-create-submit66>Create Company</button></footer>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(!developerCompanyCreateBusy66)dialog.close();});
    return dialog;
  }

  function openDeveloperCompanyCreate66(){
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    const dialog=developerCompanyCreateDialog66(),form=$('developerCompanyCreateForm66');
    form?.reset();
    const country=$('newCompanyCountry');if(country)country.innerHTML='<option value="">Select country</option>'+companyCountryOptions('');
    if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}
    const preview=dialog.querySelector('[data-developer-company-logo-preview66]');if(preview)preview.innerHTML='Company<br/>logo';
    developerCompanyCreateBusy66=false;
    const submit=dialog.querySelector('[data-developer-company-create-submit66]');if(submit){submit.disabled=false;submit.textContent='Create Company';}
    if(!dialog.open)dialog.showModal();
    setTimeout(()=>$('newCompanyName')?.focus(),0);
  }

  function closeDeveloperCompanyCreate66(){
    if(developerCompanyCreateBusy66)return;
    const dialog=$('developerCompanyCreateDialog66');if(dialog?.open)dialog.close();
    if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}
  }

  async function hydrateDeveloperCompanyLogos66(){
    const host=$('developerCompanySelector63');if(!host)return;
    for(const company of developerCompanyRows63()){
      const fileId=String(company?.logoFileId||company?.companyLogoFileId||'');if(!fileId||developerCompanyLogo63(company))continue;
      const action=host.querySelector(`[data-developer-company-open63="${CSS.escape(String(company.id||''))}"]`),slot=action?.closest('.developer-company-card63')?.querySelector('.developer-company-logo63');
      if(!slot||slot.dataset.logoFile66===fileId)continue;slot.dataset.logoFile66=fileId;
      try{const stored=await persistentFileDownload(fileId);if(!slot.isConnected||!stored?.url)continue;const img=document.createElement('img');img.src=stored.url;img.alt=`${company.name||'Company'} logo`;slot.replaceChildren(img);}catch{slot.removeAttribute('data-logo-file66');}
    }
  }

  async function createDeveloperCompany66(){
    if(developerCompanyCreateBusy66)return;
    const name=$('newCompanyName')?.value.trim()||'',code=$('newCompanyCode')?.value.trim().toUpperCase()||'',countryCode=$('newCompanyCountry')?.value||'',countryRow=countryByCode(countryCode),meetUrl=normalizeGoogleMeetUrl($('newCompanyMeetUrl')?.value||''),email=$('newCompanyEmail66')?.value.trim()||'',phone=$('newCompanyPhone66')?.value.trim()||'',logoFile=$('newCompanyLogo66')?.files?.[0]||null;
    if(!name||!code||!countryRow||!meetUrl)return toast('Enter a company name, code, registered country, and valid Google Meet interview room.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return toast('Enter a valid company email address.');
    if(logoFile&&!String(logoFile.type||'').toLowerCase().startsWith('image/'))return toast('The company profile image must be an image file.');
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    const auth=previewAuthData();
    if(auth.companies.some(c=>String(c.code||'').toUpperCase()===code))return toast('Company code already exists.');
    if(auth.companies.some(c=>normalizeGoogleMeetUrl(c.interviewMeetUrl)===meetUrl))return toast('That Google Meet room is already assigned to another company.');
    const companyId=`COMP-${crypto.randomUUID()}`,submit=$('developerCompanyCreateDialog66')?.querySelector('[data-developer-company-create-submit66]');
    developerCompanyCreateBusy66=true;if(submit){submit.disabled=true;submit.textContent='Creating…';}
    let logoWarning='';
    try{
      auth.companies.push({id:companyId,name,code,contactEmail:email,email,contactPhone:phone,phone,registeredCountry:countryRow.country,registeredCountryCode:countryRow.countryCode,interviewMeetUrl:meetUrl,active:true,systemEnabled:true,monthlyAmount:0,billingCurrency:'USD',paymentAccount:'',billingMessage:'',createdAt:new Date().toISOString(),createdBy:controlActorId()});
      savePreviewAuthData(auth);await queueStandaloneSave();await loadStandaloneState();
      if(logoFile){
        try{const stored=await uploadPersistentFile(logoFile,{category:'company-logo',companyId,entityType:'company',entityId:companyId,metadata:{companyName:name,companyCode:code}});if(stored?.fileId){const next=previewAuthData(),created=next.companies.find(c=>String(c.id)===companyId);if(created){created.logoFileId=stored.fileId;created.companyLogoFileId=stored.fileId;savePreviewAuthData(next);await queueStandaloneSave();await loadStandaloneState();}}}catch(err){logoWarning=` Company created, but its logo could not be stored: ${err?.message||err}`;}
      }
      await refreshControlCenter();developerCompanySelectorSearch63='';developerCompanySelectorPage63=Math.floor(Math.max(0,(developerCompanyRows63().findIndex(c=>String(c.id)===companyId)))/DEVELOPER_COMPANY_SELECTOR_PAGE_SIZE63);developerCompanySelectorOpen63=true;
      const dialog=$('developerCompanyCreateDialog66');if(dialog?.open)dialog.close();developerCompanyCreateBusy66=false;renderCompany();toast(`Company created. Its workspace card is now available.${logoWarning}`);
    }catch(err){developerCompanyCreateBusy66=false;if(submit){submit.disabled=false;submit.textContent='Create Company';}toast(err.message||String(err));}
  }

  function decorateDeveloperCompanyDirectory66(){
    const host=$('developerCompanySelector63'),header=host?.querySelector('.developer-company-selector-head63');if(!host||!header)return;
    const search=header.querySelector('label');
    if(search&&!search.closest('.developer-company-directory-tools66')){
      search.classList.add('developer-company-search66');
      const tools=document.createElement('div');tools.className='developer-company-directory-tools66';header.appendChild(tools);tools.appendChild(search);
      const create=document.createElement('button');create.type='button';create.className='developer-company-create-button66';create.dataset.developerCompanyCreate66='true';create.innerHTML='<span aria-hidden="true">＋</span> Create Company';tools.appendChild(create);
    }
    void hydrateDeveloperCompanyLogos66();
  }

  const renderDeveloperCompanySelectorBase66=renderDeveloperCompanySelector63;
  renderDeveloperCompanySelector63=function(){renderDeveloperCompanySelectorBase66();decorateDeveloperCompanyDirectory66();};

  /* Company creation now lives exclusively in Developer > Company > Companies. */
  if(typeof renderDataCompanyControls==='function'){
    const renderDataCompanyControlsBase66=renderDataCompanyControls;
    renderDataCompanyControls=function(){dataCompanyCreateOpen=false;renderDataCompanyControlsBase66();const host=$('dataConsoleTableWrap');host?.querySelector('[data-company-create-toggle]')?.remove();host?.querySelector('#developerCompanyCreate')?.remove();};
  }

  function bindDeveloperCompanyDirectory66(){
    if(window.__assuranceRegentDeveloperCompanyDirectory66)return;window.__assuranceRegentDeveloperCompanyDirectory66=true;
    document.addEventListener('click',async e=>{
      if(e.target.closest?.('[data-developer-company-create66]')){e.preventDefault();openDeveloperCompanyCreate66();return;}
      if(e.target.closest?.('[data-developer-company-create-close66]')){e.preventDefault();closeDeveloperCompanyCreate66();return;}
      if(e.target.closest?.('[data-developer-company-create-submit66]')){e.preventDefault();await createDeveloperCompany66();return;}
    },true);
    document.addEventListener('change',e=>{if(!e.target?.matches?.('#newCompanyLogo66'))return;if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}const file=e.target.files?.[0],preview=$('developerCompanyCreateDialog66')?.querySelector('[data-developer-company-logo-preview66]');if(!preview)return;if(!file){preview.innerHTML='Company<br/>logo';return;}developerCompanyLogoPreviewUrl66=URL.createObjectURL(file);const img=document.createElement('img');img.src=developerCompanyLogoPreviewUrl66;img.alt='Company logo preview';preview.replaceChildren(img);},true);
  }
  bindDeveloperCompanyDirectory66();
  /* Assurance Regent v6.3.66 — Developer Companies directory creation hub END */
