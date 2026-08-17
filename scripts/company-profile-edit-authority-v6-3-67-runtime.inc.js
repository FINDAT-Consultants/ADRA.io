  /* Assurance Regent v6.3.67 — governed company/profile completion START */
  let companyProfileEditTarget67='',companyProfileEditBusy67=false,companyProfileLogoPreviewUrl67='';

  function companyProfileAuthority67(){try{return functionalAuthority(effectiveUserOrg(controlUser()||{}));}catch{return String(controlUser()?.role||'').toUpperCase();}}
  function companyProfileCanEdit67(company={}){const u=controlUser(),authority=companyProfileAuthority67();if(!u||!company?.id)return false;if(authority==='DEVELOPER'||u.role==='Developer')return true;return ['CEO','ADMINISTRATOR'].includes(authority)&&String(u.companyId||'')===String(company.id||'');}
  function companyProfileById67(id=''){return (state.control?.profile?.companies||[]).find(c=>String(c.id||'')===String(id||''))||null;}

  function companyProfileEditDialog67(){
    let dialog=$('companyProfileEditDialog67');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='companyProfileEditDialog67';dialog.className='company-profile-edit-dialog67';
    dialog.innerHTML=`<form id="companyProfileEditForm67" novalidate>
      <header class="company-profile-edit-head67"><div><small>Company profile</small><h2>Edit company details</h2><p>Complete or correct the organization information shown across Assurance Regent. Protected system controls remain separate.</p></div><button type="button" data-company-profile-close67 aria-label="Close company profile editor">×</button></header>
      <div class="company-profile-edit-body67">
        <div class="company-profile-edit-logo-row67"><div class="company-profile-edit-logo67" data-company-profile-logo67>Logo</div><div><b>Company logo</b><small>Upload or replace the organization image used on its directory card and workspace.</small><label class="company-profile-logo-picker67"><span>＋</span> Choose logo<input id="companyProfileLogo67" type="file" accept="image/*" /></label></div></div>
        <div class="company-profile-edit-grid67">
          <label>Company name<input id="companyProfileName67" autocomplete="organization" required /></label>
          <label>Company code<input id="companyProfileCode67" readonly aria-readonly="true" /></label>
          <label>Company email<input id="companyProfileEmail67" type="email" autocomplete="email" placeholder="company@example.com" /></label>
          <label>Contact number<input id="companyProfilePhone67" type="tel" autocomplete="tel" placeholder="+260 ..." /></label>
          <label>Registered country<input id="companyProfileCountry67" readonly aria-readonly="true" /></label>
          <label>Interview room<input id="companyProfileMeet67" readonly aria-readonly="true" /></label>
        </div>
        <div class="company-profile-boundary67"><b>Protected fields</b><span>Company code and original registration country are retained as system identity records. Google Meet, billing and service shutdown controls remain Developer-governed.</span></div>
      </div>
      <footer class="company-profile-edit-foot67"><button type="button" class="company-profile-cancel67" data-company-profile-close67>Cancel</button><button type="button" class="company-profile-save67" data-company-profile-save67>Save changes</button></footer>
    </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();if(!companyProfileEditBusy67)closeCompanyProfileEdit67();});
    return dialog;
  }

  function resetCompanyProfileLogoPreview67(){if(companyProfileLogoPreviewUrl67){URL.revokeObjectURL(companyProfileLogoPreviewUrl67);companyProfileLogoPreviewUrl67='';}}
  async function renderCompanyProfileLogo67(company={}){const slot=$('companyProfileEditDialog67')?.querySelector('[data-company-profile-logo67]');if(!slot)return;const inline=developerCompanyLogo63?.(company)||'';if(inline){slot.innerHTML=`<img src="${esc(inline)}" alt="${esc(company.name||'Company')} logo"/>`;return;}const fileId=String(company.logoFileId||company.companyLogoFileId||'');if(fileId){try{const stored=await persistentFileDownload(fileId);if(slot.isConnected&&stored?.url)slot.innerHTML=`<img src="${esc(stored.url)}" alt="${esc(company.name||'Company')} logo"/>`;return;}catch{}}slot.textContent=typeof dataCompanyInitials==='function'?dataCompanyInitials(company):companyInitials(company.name||company.code||'CO');}

  function openCompanyProfileEdit67(companyId=''){
    const company=companyProfileById67(companyId||activeCompanyForView?.()?.id||'');if(!company)return toast('Company profile was not found.');
    if(!companyProfileCanEdit67(company))return toast('Administrator or Developer permission is required to edit this company profile.');
    companyProfileEditTarget67=String(company.id||'');companyProfileEditBusy67=false;resetCompanyProfileLogoPreview67();
    const dialog=companyProfileEditDialog67();const form=$('companyProfileEditForm67');form?.reset();
    if($('companyProfileName67'))$('companyProfileName67').value=company.name||'';
    if($('companyProfileCode67'))$('companyProfileCode67').value=company.code||'';
    if($('companyProfileEmail67'))$('companyProfileEmail67').value=company.contactEmail||company.email||'';
    if($('companyProfilePhone67'))$('companyProfilePhone67').value=company.contactPhone||company.phone||'';
    if($('companyProfileCountry67'))$('companyProfileCountry67').value=company.registeredCountry||'Not set';
    if($('companyProfileMeet67'))$('companyProfileMeet67').value=company.interviewMeetUrl||'Not set';
    const save=dialog.querySelector('[data-company-profile-save67]');if(save){save.disabled=false;save.textContent='Save changes';}
    void renderCompanyProfileLogo67(company);if(!dialog.open)dialog.showModal();setTimeout(()=>$('companyProfileName67')?.focus(),0);
  }
  function closeCompanyProfileEdit67(){if(companyProfileEditBusy67)return;const dialog=$('companyProfileEditDialog67');if(dialog?.open)dialog.close();resetCompanyProfileLogoPreview67();companyProfileEditTarget67='';}

  async function saveCompanyProfileEdit67(){
    if(companyProfileEditBusy67)return;const company=companyProfileById67(companyProfileEditTarget67);if(!company)return toast('Company profile was not found.');if(!companyProfileCanEdit67(company))return toast('Administrator or Developer permission is required.');
    const name=$('companyProfileName67')?.value.trim()||'',email=$('companyProfileEmail67')?.value.trim()||'',phone=$('companyProfilePhone67')?.value.trim()||'',logoFile=$('companyProfileLogo67')?.files?.[0]||null;
    if(!name)return toast('Company name is required.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return toast('Enter a valid company email address.');if(phone.length>40)return toast('Contact number is too long.');if(logoFile&&!String(logoFile.type||'').toLowerCase().startsWith('image/'))return toast('Choose an image file for the company logo.');
    const save=$('companyProfileEditDialog67')?.querySelector('[data-company-profile-save67]');companyProfileEditBusy67=true;if(save){save.disabled=true;save.textContent='Saving…';}
    try{
      let logoFileId=null;if(logoFile){const stored=await uploadPersistentFile(logoFile,{category:'company-logo',companyId:company.id,entityType:'company',entityId:company.id,metadata:{companyName:name,updatedBy:controlActorId()}});logoFileId=stored?.fileId||null;}
      await supabaseRpc('assurance_regent_browser_company_profile_update',{p_token:browserSessionToken,p_company_id:company.id,p_name:name,p_email:email,p_phone:phone,p_logo_file_id:logoFileId},{bypassCache:true});
      await loadStandaloneState();await refreshControlCenter();companyProfileEditBusy67=false;const dialog=$('companyProfileEditDialog67');if(dialog?.open)dialog.close();resetCompanyProfileLogoPreview67();companyProfileEditTarget67='';renderCompany();toast('Company profile updated.');
    }catch(err){companyProfileEditBusy67=false;if(save){save.disabled=false;save.textContent='Save changes';}toast(err?.message||String(err));}
  }

  function decorateDeveloperCompanyEditActions67(){const host=$('developerCompanySelector63');if(!host)return;host.querySelectorAll('article.developer-company-card63').forEach(card=>{const open=card.querySelector('[data-developer-company-open63]');if(!open||card.querySelector('[data-company-profile-edit67]'))return;const companyId=String(open.dataset.developerCompanyOpen63||'');const actions=document.createElement('div');actions.className='developer-company-card-actions67';const edit=document.createElement('button');edit.type='button';edit.className='developer-company-edit67';edit.dataset.companyProfileEdit67=companyId;edit.innerHTML='<span aria-hidden="true">✎</span> Edit details';open.replaceWith(actions);actions.append(edit,open);});}
  const renderDeveloperCompanySelectorBase67=renderDeveloperCompanySelector63;
  renderDeveloperCompanySelector63=function(){renderDeveloperCompanySelectorBase67();decorateDeveloperCompanyEditActions67();};

  function decorateCompanyWorkspaceProfile67(){const workspace=document.querySelector('#view-company .company-workspace'),company=activeCompanyForView?.();if(!workspace||workspace.hidden||!company||!companyProfileCanEdit67(company))return;const header=workspace.querySelector('.company-page-header');if(!header)return;let button=header.querySelector('[data-company-profile-workspace67]');if(!button){button=document.createElement('button');button.type='button';button.className='company-profile-workspace-edit67';button.dataset.companyProfileWorkspace67='true';button.innerHTML='<span aria-hidden="true">✎</span> Edit company profile';const search=header.querySelector('.company-search');if(search)header.insertBefore(button,search);else header.appendChild(button);}button.dataset.companyProfileEdit67=String(company.id||'');}
  const renderCompanyBase67=renderCompany;
  renderCompany=function(){renderCompanyBase67();decorateCompanyWorkspaceProfile67();};

  function decorateOwnProfileCompletion67(){const email=$('profileEmail');if(!email)return;let phone=$('profilePhone67');if(!phone){const emailLabel=email.closest('label');const label=document.createElement('label');label.innerHTML='Contact number<input id="profilePhone67" type="tel" autocomplete="tel" placeholder="Add contact number" />';emailLabel?.insertAdjacentElement('afterend',label);phone=$('profilePhone67');}const u=controlUser();if(phone)phone.value=u?.phone||u?.contactPhone||'';const section=email.closest('.control-settings-section');if(section&&!section.querySelector('.profile-owner-note67')){const note=document.createElement('div');note.className='profile-owner-note67';note.innerHTML='<b>Your profile, your details</b><span>You can complete or correct your own email, contact number and profile image at any time.</span>';section.appendChild(note);}}
  const renderProfilePaneBase67=renderProfilePane;
  renderProfilePane=function(){renderProfilePaneBase67();decorateOwnProfileCompletion67();};

  function decorateAccessContactFields67(){const grid=$('accessUserSelect')?.closest('.access-admin-grid');if(!grid||$('accessEmail67'))return;const companyWrap=$('accessCompanyWrap')?.closest('label')||$('accessCompanyWrap');const email=document.createElement('label');email.innerHTML='Work email<input id="accessEmail67" type="email" autocomplete="off" />';const phone=document.createElement('label');phone.innerHTML='Contact number<input id="accessPhone67" type="tel" autocomplete="off" />';if(companyWrap){companyWrap.insertAdjacentElement('afterend',phone);companyWrap.insertAdjacentElement('afterend',email);}else{grid.append(email,phone);}}
  const fillAccessUserFieldsBase67=fillAccessUserFields;
  fillAccessUserFields=function(){decorateAccessContactFields67();fillAccessUserFieldsBase67();const target=selectedAccessUser?.();if($('accessEmail67'))$('accessEmail67').value=target?.email||'';if($('accessPhone67'))$('accessPhone67').value=target?.phone||target?.contactPhone||'';};

  function bindCompanyProfileAuthority67(){if(window.__assuranceRegentCompanyProfileAuthority67)return;window.__assuranceRegentCompanyProfileAuthority67=true;document.addEventListener('click',async e=>{const edit=e.target.closest?.('[data-company-profile-edit67]');if(edit){e.preventDefault();e.stopPropagation();openCompanyProfileEdit67(edit.dataset.companyProfileEdit67||'');return;}if(e.target.closest?.('[data-company-profile-close67]')){e.preventDefault();closeCompanyProfileEdit67();return;}if(e.target.closest?.('[data-company-profile-save67]')){e.preventDefault();await saveCompanyProfileEdit67();return;}},true);document.addEventListener('change',e=>{if(!e.target?.matches?.('#companyProfileLogo67'))return;resetCompanyProfileLogoPreview67();const file=e.target.files?.[0],slot=$('companyProfileEditDialog67')?.querySelector('[data-company-profile-logo67]');if(!slot)return;if(!file){void renderCompanyProfileLogo67(companyProfileById67(companyProfileEditTarget67)||{});return;}companyProfileLogoPreviewUrl67=URL.createObjectURL(file);slot.innerHTML=`<img src="${esc(companyProfileLogoPreviewUrl67)}" alt="Company logo preview"/>`;},true);}
  bindCompanyProfileAuthority67();
  /* Assurance Regent v6.3.67 — governed company/profile completion END */
