  /* Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START */
  const ALL_EMPLOYEES_RATE82='__ALL_EMPLOYEES__';
  const ALL_PROJECTS_RATE82='__ALL_PROJECTS__';
  let developerCompanyCreatePage82=1;

  function ensureOperationalPolishStyles82(){
    if($('operationalPolishStyles82'))return;
    const style=document.createElement('style');style.id='operationalPolishStyles82';
    style.textContent=`
      #recruitPanelInterviews .panel-head.interview-evidence-head82{display:flex;align-items:center;gap:14px;justify-content:space-between}
      .interview-evidence-actions82{display:flex;align-items:center;justify-content:flex-end;margin-left:auto;flex:0 0 auto}
      .interview-evidence-actions82 .btn{white-space:nowrap}
      #settingsApiConnectionsSection79.api-connections-compact82{padding:18px}
      .api-connections-buttons82{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .api-connections-buttons82 .btn{min-width:148px}
      #controlPaneSettings.api-connections-compact82 #controlSettingsForm>.control-form-actions{display:none!important}
      .rate-default-reset82{margin-top:7px;align-self:flex-start}
      .rate-overrides .rate-override82{display:flex;align-items:center;justify-content:space-between;gap:14px}
      .rate-override82>div:first-child{display:grid;gap:3px;min-width:0}
      .rate-override82-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto}
      .developer-company-create-progress82{display:flex;align-items:center;gap:8px;margin-top:10px}
      .developer-company-create-progress82 span{width:8px;height:8px;border-radius:999px;background:#d6e1e6}
      .developer-company-create-progress82 span.active{width:24px;background:currentColor}
      .developer-company-create-page82[hidden]{display:none!important}
      .developer-company-currency-card82{margin-top:14px;padding:14px;border:1px solid #dce7eb;border-radius:14px;display:grid;gap:4px}
      .developer-company-currency-card82 b{font-size:13px}
      .developer-company-currency-card82 span{font-size:11px;opacity:.72}
      @media(max-width:720px){
        #recruitPanelInterviews .panel-head.interview-evidence-head82{align-items:flex-start}
        .interview-evidence-actions82{margin-left:0}
        .api-connections-buttons82{align-items:stretch;flex-direction:column}
        .api-connections-buttons82 .btn{width:100%}
        .rate-overrides .rate-override82{align-items:flex-start;flex-direction:column}
      }`;
    document.head.appendChild(style);
  }

  function interviewEvidenceActions82(){
    const panel=$('recruitPanelInterviews')?.querySelector('.recruit-interview-grid > section.panel');
    const head=panel?.querySelector('.panel-head');if(!head)return null;
    head.classList.add('interview-evidence-head82');
    let actions=head.querySelector('[data-interview-evidence-actions82]');
    if(!actions){actions=document.createElement('div');actions.className='interview-evidence-actions82';actions.dataset.interviewEvidenceActions82='1';head.appendChild(actions);}
    return actions;
  }

  renderMeetInterviewAssistant78=async function(){
    ensureMeetAssistantStyles78();ensureOperationalPolishStyles82();
    $('meetInterviewAssistant78')?.remove();
    const actions=interviewEvidenceActions82();if(!actions||!recruitmentHrAllowed())return;
    const selected=String(state.recruitVacancy||'');
    actions.innerHTML=`<button type="button" class="btn micro ghost" data-meet-compare78 ${selected?'':'disabled title="Select one vacancy first"'}>Compare interview evidence</button>`;
    document.querySelectorAll('#recruitInterviewsTable [data-interview-action="room"]').forEach(room=>{
      const cell=room.closest('.recruit-row-actions');if(!cell||cell.querySelector('[data-jivan-interview-notes78]'))return;
      const button=document.createElement('button');button.type='button';button.className='btn micro secondary';button.dataset.jivanInterviewNotes78=String(room.dataset.interviewId||'');button.textContent='Jivan notes';cell.appendChild(button);
    });
    removeLegacyApiConnectionUi79();
  };

  const ensureApiConnectionsSectionBase82=ensureApiConnectionsSection79;
  ensureApiConnectionsSection79=function(){
    const section=ensureApiConnectionsSectionBase82();
    SETTINGS_PAGE_META[API_CONNECTIONS_PAGE79]=['API Connections',''];
    return section;
  };

  renderApiConnections79=function(){
    ensureOperationalPolishStyles82();syncApiConnectionsVisibility79();if(!apiConnectionsDeveloper79())return;
    const section=ensureApiConnectionsSection79();if(!section)return;
    const googleConnected=Boolean(gmailStatus77?.connected);
    section.classList.add('api-connections-compact82');
    section.innerHTML=`<div class="api-connections-buttons82" aria-label="API connection controls">
      <button type="button" class="btn primary small" data-api-google-connect79>Reconnect Google Workspace</button>
      <button type="button" class="btn ghost small" data-api-google-disconnect79 ${googleConnected?'':'disabled'}>Disconnect</button>
      <button type="button" class="btn ghost small" data-api-connections-refresh79>Refresh status</button>
    </div>`;
  };

  const showSettingsPageBase82=showSettingsPage;
  showSettingsPage=function(page='general'){
    const result=showSettingsPageBase82(page),apiPage=String(settingsActivePage||'')===String(API_CONNECTIONS_PAGE79);
    const pane=$('controlPaneSettings');if(pane)pane.classList.toggle('api-connections-compact82',apiPage);
    const subtitle=$('settingsPageSubtitle');if(subtitle){subtitle.hidden=apiPage;if(apiPage)subtitle.textContent='';}
    if(apiPage){SETTINGS_PAGE_META[API_CONNECTIONS_PAGE79]=['API Connections',''];renderApiConnections79();}
    return result;
  };

  function costingRows82(){
    const s=state.control?.settings||defaultLocalControl().settings;
    const employees=Object.entries(s.employeeHourlyRates||{}).map(([id,rate])=>({kind:'employee',id,label:employeeRecord(id,'')?.name||id,rate}));
    const projects=Object.entries(s.projectHourlyRates||{}).map(([id,rate])=>({kind:'project',id,label:id,rate}));
    return [...employees,...projects];
  }

  function renderCostingPolish82(){
    ensureOperationalPolishStyles82();
    const s=state.control?.settings||defaultLocalControl().settings,can=Boolean(controlPermissions().canManageSettings);
    const employeeSelect=$('settingsEmployeeRateEmployee'),projectSelect=$('settingsProjectRateProject');
    if(employeeSelect){
      const current=employeeSelect.value;
      employeeSelect.innerHTML='<option value="">Select employee</option><option value="'+ALL_EMPLOYEES_RATE82+'">Select all employees</option>'+engine.state.employees.map(e=>`<option value="${esc(e.employeeId)}">${esc(e.name)} · ${esc(e.employeeId)}</option>`).join('');
      if([...employeeSelect.options].some(o=>o.value===current))employeeSelect.value=current;
    }
    if(projectSelect){
      const current=projectSelect.value;
      projectSelect.innerHTML='<option value="">Select project</option><option value="'+ALL_PROJECTS_RATE82+'">Select all projects</option>'+engine.state.projects.map(p=>`<option value="${esc(p.code)}">${esc(p.code)} · ${esc(p.name||p.code)}</option>`).join('');
      if([...projectSelect.options].some(o=>o.value===current))projectSelect.value=current;
    }
    const defaultInput=$('settingsDefaultHourlyRate');
    if(defaultInput&&!defaultInput.parentElement?.querySelector('[data-rate-reset-default82]')){
      const reset=document.createElement('button');reset.type='button';reset.className='btn micro ghost rate-default-reset82';reset.dataset.rateResetDefault82='1';reset.textContent='Reset default rate';reset.disabled=!can;defaultInput.insertAdjacentElement('afterend',reset);
    }else if(defaultInput?.parentElement?.querySelector('[data-rate-reset-default82]'))defaultInput.parentElement.querySelector('[data-rate-reset-default82]').disabled=!can;
    const host=$('settingsRateOverrides'),rows=costingRows82();
    if(host)host.innerHTML=rows.length?rows.map(row=>`<article class="rate-override82"><div><b>${row.kind==='employee'?'Employee':'Project'}: ${esc(row.label)}</b><span>${money(row.rate,s.currency,2)} / hour</span></div><div class="rate-override82-actions"><button type="button" class="btn micro ghost" data-rate-edit82="${row.kind}" data-rate-id82="${encodeURIComponent(row.id)}" ${can?'':'disabled'}>Edit</button><button type="button" class="btn micro ghost" data-rate-delete82="${row.kind}" data-rate-id82="${encodeURIComponent(row.id)}" ${can?'':'disabled'}>Delete</button></div></article>`).join(''):emptyControl('No rate overrides','The default hourly rate applies until an employee or project override is configured.');
  }

  const renderSettingsPaneBase82=renderSettingsPane;
  renderSettingsPane=function(){const result=renderSettingsPaneBase82();renderCostingPolish82();return result;};

  const saveControlSettingsBase82=saveControlSettings;
  saveControlSettings=async function(e){
    if(!STANDALONE_MODE)return saveControlSettingsBase82(e);
    e?.preventDefault?.();
    if(!controlPermissions().canManageSettings)return toast('Administrator permission is required to change settings.');
    try{
      const c=localControlStore(),settings=c.settings||(c.settings={...defaultLocalControl().settings});
      if(!settings.employeeHourlyRates||typeof settings.employeeHourlyRates!=='object')settings.employeeHourlyRates={};
      if(!settings.projectHourlyRates||typeof settings.projectHourlyRates!=='object')settings.projectHourlyRates={};
      const idx=$('settingsCurrencyCountry')?.value??'',cur=idx===''?null:(window.ADRA_CURRENCIES||[])[Number(idx)];
      if(cur)Object.assign(settings,{countryCode:cur.countryCode,country:cur.country,currency:cur.currency,currencyName:cur.currencyName});
      settings.defaultHourlyRate=Number($('settingsDefaultHourlyRate')?.value||0);
      const employeeChoice=$('settingsEmployeeRateEmployee')?.value||'',employeeRaw=$('settingsEmployeeRate')?.value??'';
      if(employeeChoice&&employeeRaw!==''){
        const rate=Number(employeeRaw);if(!Number.isFinite(rate)||rate<0)throw new Error('Enter a valid employee hourly rate.');
        if(employeeChoice===ALL_EMPLOYEES_RATE82)for(const employee of engine.state.employees)settings.employeeHourlyRates[String(employee.employeeId)]=rate;
        else settings.employeeHourlyRates[employeeChoice]=rate;
      }
      const projectChoice=$('settingsProjectRateProject')?.value||'',projectRaw=$('settingsProjectRate')?.value??'';
      if(projectChoice&&projectRaw!==''){
        const rate=Number(projectRaw);if(!Number.isFinite(rate)||rate<0)throw new Error('Enter a valid project hourly rate.');
        if(projectChoice===ALL_PROJECTS_RATE82)for(const project of engine.state.projects)settings.projectHourlyRates[String(project.code)]=rate;
        else settings.projectHourlyRates[projectChoice]=rate;
      }
      saveLocalControlStore(c);await queueStandaloneSave();toast('Currency and hourly-rate settings saved.');await refreshControlCenter();renderSettingsPane();refreshCurrent();
    }catch(err){toast(err?.message||String(err));}
  };

  function editRateOverride82(kind,id){
    const settings=state.control?.settings||{},isEmployee=kind==='employee',select=$(isEmployee?'settingsEmployeeRateEmployee':'settingsProjectRateProject'),input=$(isEmployee?'settingsEmployeeRate':'settingsProjectRate');
    const map=isEmployee?settings.employeeHourlyRates:settings.projectHourlyRates;if(!select||!input||!map||map[id]===undefined)return;
    select.value=id;input.value=map[id];input.focus();input.select?.();
  }

  async function deleteRateOverride82(kind,id){
    if(!controlPermissions().canManageSettings)return toast('Administrator permission is required to change settings.');
    const label=kind==='employee'?'employee':'project';
    if(!confirm(`Delete this ${label} hourly-rate override? The default hourly rate will apply instead.`))return;
    const c=localControlStore(),map=kind==='employee'?c.settings.employeeHourlyRates:c.settings.projectHourlyRates;
    if(map&&Object.prototype.hasOwnProperty.call(map,id))delete map[id];
    saveLocalControlStore(c);await queueStandaloneSave();await refreshControlCenter();renderSettingsPane();refreshCurrent();toast(`${kind==='employee'?'Employee':'Project'} rate override deleted.`);
  }

  async function resetDefaultRate82(){
    if(!controlPermissions().canManageSettings)return toast('Administrator permission is required to change settings.');
    if(!confirm('Reset the default hourly rate to 0?'))return;
    const c=localControlStore();c.settings.defaultHourlyRate=0;saveLocalControlStore(c);await queueStandaloneSave();await refreshControlCenter();renderSettingsPane();refreshCurrent();toast('Default hourly rate reset.');
  }

  function developerCompanyCurrencyOptions82(selected=''){
    const rows=window.ADRA_CURRENCIES||[];
    return '<option value="">Choose country and currency</option>'+rows.map((row,index)=>`<option value="${index}" ${String(index)===String(selected)?'selected':''}>${esc(row.country)} — ${esc(row.currency)} (${esc(row.currencyName)})</option>`).join('');
  }

  function developerCompanyCurrencyRow82(){
    const value=$('newCompanyCurrencyCountry82')?.value??'';return value===''?null:(window.ADRA_CURRENCIES||[])[Number(value)]||null;
  }

  function updateDeveloperCompanyCurrencyPreview82(){
    const box=$('newCompanyCurrencyPreview82'),row=developerCompanyCurrencyRow82();if(!box)return;
    box.innerHTML=row?`<b>${esc(row.country)}</b><span>${esc(row.currency)} · ${esc(row.currencyName)}</span>`:'<b>Select a country and currency</b><span>The company will use this currency for its billing and monetary defaults.</span>';
  }

  developerCompanyCreateDialog66=function(){
    let dialog=$('developerCompanyCreateDialog66');
    if(dialog?.dataset?.currencyWizard82==='1')return dialog;
    if(dialog)dialog.remove();
    dialog=document.createElement('dialog');dialog.id='developerCompanyCreateDialog66';dialog.className='developer-company-create-dialog66';dialog.dataset.currencyWizard82='1';
    dialog.innerHTML=`<form id="developerCompanyCreateForm66" novalidate>
      <header class="developer-company-create-head66"><div><small>Developer company directory</small><h2>Create Company</h2><p>Create the organization profile, then choose its country and currency.</p><div class="developer-company-create-progress82" aria-label="Step progress"><span class="active" data-company-create-dot82="1"></span><span data-company-create-dot82="2"></span></div></div><button type="button" class="developer-company-create-close66" data-developer-company-create-close66 aria-label="Close Create Company">×</button></header>
      <div class="developer-company-create-body66">
        <section class="developer-company-create-page82" data-developer-company-page82="1">
          <div class="developer-company-profile-row66"><div class="developer-company-logo-preview66" data-developer-company-logo-preview66>Company<br/>logo</div><div class="developer-company-logo-upload66"><b>Company profile image</b><small>Optional. Upload the company logo or profile image used on its directory card and inside the company workspace.</small><label><span>＋</span> Choose logo<input id="newCompanyLogo66" type="file" accept="image/*" /></label></div></div>
          <div class="developer-company-create-grid66">
            <label>Company name<input id="newCompanyName" autocomplete="organization" required /></label>
            <label>Company code<input id="newCompanyCode" autocomplete="off" maxlength="24" required /></label>
            <label>Company email<input id="newCompanyEmail66" type="email" autocomplete="email" placeholder="company@example.com" /></label>
            <label>Contact number<input id="newCompanyPhone66" type="tel" autocomplete="tel" placeholder="+260 ..." /></label>
            <label class="span-2">Google Meet interview room<input id="newCompanyMeetUrl" type="url" inputmode="url" placeholder="https://meet.google.com/abc-defg-hij" autocomplete="off" required /><span class="field-note66">This dedicated room is used by the organization for HR and candidate interviews.</span></label>
          </div>
        </section>
        <section class="developer-company-create-page82" data-developer-company-page82="2" hidden>
          <div class="developer-company-create-grid66">
            <label class="span-2">Country and currency<select id="newCompanyCurrencyCountry82" required>${developerCompanyCurrencyOptions82('')}</select><span class="field-note66">Uses the same country and currency catalogue available in Settings.</span></label>
          </div>
          <div class="developer-company-currency-card82" id="newCompanyCurrencyPreview82"></div>
        </section>
      </div>
      <footer class="developer-company-create-foot66" data-developer-company-create-foot82></footer>
    </form>`;
    document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();if(!developerCompanyCreateBusy66)dialog.close();});renderDeveloperCompanyCreatePage82(1);updateDeveloperCompanyCurrencyPreview82();return dialog;
  };

  function renderDeveloperCompanyCreatePage82(page=1){
    developerCompanyCreatePage82=Number(page)===2?2:1;const dialog=$('developerCompanyCreateDialog66');if(!dialog)return;
    dialog.querySelectorAll('[data-developer-company-page82]').forEach(section=>{section.hidden=Number(section.dataset.developerCompanyPage82)!==developerCompanyCreatePage82;});
    dialog.querySelectorAll('[data-company-create-dot82]').forEach(dot=>dot.classList.toggle('active',Number(dot.dataset.companyCreateDot82)===developerCompanyCreatePage82));
    const foot=dialog.querySelector('[data-developer-company-create-foot82]');if(!foot)return;
    foot.innerHTML=developerCompanyCreatePage82===1?'<button type="button" class="developer-company-create-cancel66" data-developer-company-create-close66>Cancel</button><button type="button" class="developer-company-create-submit66" data-developer-company-create-next82>Next: Currency & country</button>':'<button type="button" class="developer-company-create-cancel66" data-developer-company-create-back82>Back</button><button type="button" class="developer-company-create-submit66" data-developer-company-create-submit66>Create Company</button>';
  }

  openDeveloperCompanyCreate66=function(){
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    ensureOperationalPolishStyles82();const dialog=developerCompanyCreateDialog66(),form=$('developerCompanyCreateForm66');form?.reset();
    const currency=$('newCompanyCurrencyCountry82');if(currency)currency.innerHTML=developerCompanyCurrencyOptions82('');
    if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}
    const preview=dialog.querySelector('[data-developer-company-logo-preview66]');if(preview)preview.innerHTML='Company<br/>logo';
    developerCompanyCreateBusy66=false;renderDeveloperCompanyCreatePage82(1);updateDeveloperCompanyCurrencyPreview82();
    if(!dialog.open)dialog.showModal();setTimeout(()=>$('newCompanyName')?.focus(),0);
  };

  closeDeveloperCompanyCreate66=function(){
    if(developerCompanyCreateBusy66)return;const dialog=$('developerCompanyCreateDialog66');if(dialog?.open)dialog.close();
    if(developerCompanyLogoPreviewUrl66){URL.revokeObjectURL(developerCompanyLogoPreviewUrl66);developerCompanyLogoPreviewUrl66='';}
  };

  function nextDeveloperCompanyCreate82(){
    const name=$('newCompanyName')?.value.trim()||'',code=$('newCompanyCode')?.value.trim().toUpperCase()||'',meetUrl=normalizeGoogleMeetUrl($('newCompanyMeetUrl')?.value||''),email=$('newCompanyEmail66')?.value.trim()||'';
    if(!name||!code||!meetUrl)return toast('Enter a company name, code, and valid Google Meet interview room.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return toast('Enter a valid company email address.');
    renderDeveloperCompanyCreatePage82(2);updateDeveloperCompanyCurrencyPreview82();setTimeout(()=>$('newCompanyCurrencyCountry82')?.focus(),0);
  }

  createDeveloperCompany66=async function(){
    if(developerCompanyCreateBusy66)return;
    const name=$('newCompanyName')?.value.trim()||'',code=$('newCompanyCode')?.value.trim().toUpperCase()||'',currencyRow=developerCompanyCurrencyRow82(),meetUrl=normalizeGoogleMeetUrl($('newCompanyMeetUrl')?.value||''),email=$('newCompanyEmail66')?.value.trim()||'',phone=$('newCompanyPhone66')?.value.trim()||'',logoFile=$('newCompanyLogo66')?.files?.[0]||null;
    if(!name||!code||!currencyRow||!meetUrl)return toast('Enter the company details and choose a country and currency.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))return toast('Enter a valid company email address.');
    if(logoFile&&!String(logoFile.type||'').toLowerCase().startsWith('image/'))return toast('The company profile image must be an image file.');
    if(controlUser()?.role!=='Developer')return toast('Developer permission is required to create a company.');
    const auth=previewAuthData();if(auth.companies.some(c=>String(c.code||'').toUpperCase()===code))return toast('Company code already exists.');if(auth.companies.some(c=>normalizeGoogleMeetUrl(c.interviewMeetUrl)===meetUrl))return toast('That Google Meet room is already assigned to another company.');
    const companyId=`COMP-${crypto.randomUUID()}`,submit=$('developerCompanyCreateDialog66')?.querySelector('[data-developer-company-create-submit66]');
    developerCompanyCreateBusy66=true;if(submit){submit.disabled=true;submit.textContent='Creating…';}
    let logoWarning='';
    try{
      auth.companies.push({id:companyId,name,code,contactEmail:email,email,contactPhone:phone,phone,registeredCountry:currencyRow.country,registeredCountryCode:currencyRow.countryCode,country:currencyRow.country,countryCode:currencyRow.countryCode,currency:currencyRow.currency,currencyName:currencyRow.currencyName,interviewMeetUrl:meetUrl,active:true,systemEnabled:true,monthlyAmount:0,billingCurrency:currencyRow.currency,billingCurrencyName:currencyRow.currencyName,paymentAccount:'',billingMessage:'',createdAt:new Date().toISOString(),createdBy:controlActorId()});
      savePreviewAuthData(auth);await queueStandaloneSave();await loadStandaloneState();
      if(logoFile){
        try{const stored=await uploadPersistentFile(logoFile,{category:'company-logo',companyId,entityType:'company',entityId:companyId,metadata:{companyName:name,companyCode:code}});if(stored?.fileId){const next=previewAuthData(),created=next.companies.find(c=>String(c.id)===companyId);if(created){created.logoFileId=stored.fileId;created.companyLogoFileId=stored.fileId;savePreviewAuthData(next);await queueStandaloneSave();await loadStandaloneState();}}}catch(err){logoWarning=` Company created, but its logo could not be stored: ${err?.message||err}`;}
      }
      await refreshControlCenter();developerCompanySelectorSearch63='';developerCompanySelectorPage63=Math.floor(Math.max(0,developerCompanyRows63().findIndex(c=>String(c.id)===companyId))/DEVELOPER_COMPANY_SELECTOR_PAGE_SIZE63);developerCompanySelectorOpen63=true;
      const dialog=$('developerCompanyCreateDialog66');if(dialog?.open)dialog.close();developerCompanyCreateBusy66=false;renderCompany();toast(`Company created with ${currencyRow.currency} as its currency.${logoWarning}`);
    }catch(err){developerCompanyCreateBusy66=false;if(submit){submit.disabled=false;submit.textContent='Create Company';}toast(err?.message||String(err));}
  };

  if(!window.__assuranceRegentOperationalPolish82){
    window.__assuranceRegentOperationalPolish82=true;
    document.addEventListener('click',e=>{
      const edit=e.target.closest?.('[data-rate-edit82]'),remove=e.target.closest?.('[data-rate-delete82]'),reset=e.target.closest?.('[data-rate-reset-default82]'),next=e.target.closest?.('[data-developer-company-create-next82]'),back=e.target.closest?.('[data-developer-company-create-back82]');
      if(edit){e.preventDefault();editRateOverride82(edit.dataset.rateEdit82,decodeURIComponent(edit.dataset.rateId82||''));return;}
      if(remove){e.preventDefault();void deleteRateOverride82(remove.dataset.rateDelete82,decodeURIComponent(remove.dataset.rateId82||''));return;}
      if(reset){e.preventDefault();void resetDefaultRate82();return;}
      if(next){e.preventDefault();nextDeveloperCompanyCreate82();return;}
      if(back){e.preventDefault();renderDeveloperCompanyCreatePage82(1);setTimeout(()=>$('newCompanyName')?.focus(),0);}
    },true);
    document.addEventListener('change',e=>{if(e.target?.matches?.('#newCompanyCurrencyCountry82'))updateDeveloperCompanyCurrencyPreview82();},true);
  }
  ensureOperationalPolishStyles82();
  /* Assurance Regent v6.3.82 — interview, settings, costing and company creation polish END */