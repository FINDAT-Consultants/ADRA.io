import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

const makeAdminMarkup=`<details class="developer-account-controls make-admin-controls" id="developerMakeAdminControls" hidden><summary>Make administrator</summary>
  <div class="make-admin-body">
    <label>User / username<select id="developerMakeAdminUser"><option value="">Select user</option></select><small>Select an active approved company user to grant Administrator access.</small></label>
    <div class="make-admin-action-row"><button type="button" class="btn primary small" id="developerMakeAdminBtn">Make admin</button></div>
  </div>
</details>`;

function patchHtml(file){
  let source=readFileSync(file,'utf8'),original=source;
  const sectionRe=/<section class="control-settings-section" id="accessManagementSection"[^>]*>[\s\S]*?<\/section>/u;
  const match=source.match(sectionRe);
  if(!match)throw new Error(`Access & Roles section missing in ${basename(file)}.`);
  const section=match[0],create=section.match(/<details class="developer-account-controls" id="developerAccountControls"[^>]*>[\s\S]*?<\/details>/u)?.[0];
  if(!create)throw new Error(`Create approved account control missing in ${basename(file)}.`);
  const replacement=`<section class="control-settings-section" id="accessManagementSection" data-settings-page="access" hidden>
    <div class="settings-section-head"><div><b>Access &amp; Roles</b><small>Administrator assignment for Developers and company CEOs. Approved account creation remains Developer-only.</small></div></div>
    ${makeAdminMarkup}
    ${create}
  </section>`;
  source=source.replace(sectionRe,replacement);
  if(source!==original)writeFileSync(file,source,'utf8');
  console.log(`[make-admin] ${basename(file)} access-fields=removed developer-and-ceo-admin-control=enabled`);
}

const helper=`
  /* Assurance Regent v6.3.39 — Developer or company CEO administrator elevation. */
  function executiveAdministratorCanMakeAdmin(user=controlUser()||{}){
    if(String(user?.role||'')==='Developer')return true;
    if(String(user?.role||'')!=='Administrator')return false;
    const effective=effectiveUserOrg(user||{}),authority=functionalAuthority(effective),text=[effective?.supervisoryRole,effective?.position,effective?.department].filter(Boolean).join(' ').toLowerCase();
    return authority==='CEO'||/(^|[^a-z])(chief executive officer|ceo|country director|managing director|country partner)([^a-z]|$)/.test(text);
  }
  function renderDeveloperMakeAdminControl(users=[],isDev=false){
    const actor=controlUser()||{},canGrant=executiveAdministratorCanMakeAdmin(actor),actorCompany=String(actor.companyId||''),box=$('developerMakeAdminControls'),select=$('developerMakeAdminUser'),nav=document.querySelector('[data-settings-nav="access"]'),section=$('accessManagementSection');
    if(nav){nav.dataset.permissionHidden=canGrant?'false':'true';nav.hidden=!canGrant;}if(section)section.hidden=!canGrant||settingsActivePage!=='access';
    if(!box||!select)return;box.hidden=!canGrant;
    if(!canGrant){select.innerHTML='<option value="">Developer or company CEO permission required</option>';if(settingsActivePage==='access')showSettingsPage('general');return;}
    const current=select.value,eligible=(Array.isArray(users)?users:[]).filter(x=>{const role=String(x?.role||'Employee'),status=String(x?.approvalStatus||((x?.active===false)?'SUSPENDED':'APPROVED')).toUpperCase(),active=x?.active!==false&&String(x?.active??'true').toLowerCase()!=='false',company=String(x?.companyId||'').trim();return role==='Employee'&&status==='APPROVED'&&active&&Boolean(company)&&(isDev||company===actorCompany);});
    select.innerHTML='<option value="">Select user / username</option>'+eligible.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.id)+' — '+esc(x.name||x.id)+'</option>').join('');if(eligible.some(x=>String(x.id)===String(current)))select.value=current;
  }
  async function developerMakeAdminUi(){
    if(!executiveAdministratorCanMakeAdmin(controlUser()||{}))return toast('Developer or company CEO permission is required.');const id=$('developerMakeAdminUser')?.value||'';if(!id)return toast('Select a user / username first.');const target=(state.control?.profile?.users||[]).find(x=>String(x.id)===String(id));if(!target)return toast('The selected user could not be found.');
    if(!confirm('Make '+(target.name||target.id)+' an Administrator? This grants company-level administrative access.'))return;
    const btn=$('developerMakeAdminBtn'),label=btn?.textContent||'Make admin';try{if(btn){btn.disabled=true;btn.textContent='Assigning…';}const result=await supabaseRpc('assurance_regent_browser_developer_make_admin',{p_token:browserSessionToken,p_user_id:id});await loadStandaloneState();await refreshControlCenter();renderSettingsPane();showSettingsPage('access');toast(result?.alreadyAdministrator?(target.name||id)+' is already an Administrator.':(target.name||id)+' is now an Administrator.');}catch(err){toast(err.message);}finally{if(btn){btn.disabled=false;btn.textContent=label;}}
  }
`;

function patchApp(file){
  let source=readFileSync(file,'utf8'),original=source;
  if(!source.includes('function renderDeveloperMakeAdminControl(')){
    const anchor='  async function developerCreateAccountUi(){';if(!source.includes(anchor))throw new Error(`Developer account helper anchor missing in ${basename(file)}.`);source=source.replace(anchor,helper+'\n'+anchor);
  }
  source=source.replace("if($('accessManagementSection'))$('accessManagementSection').hidden=!perm.canManageUsers;","if($('accessManagementSection'))$('accessManagementSection').hidden=!executiveAdministratorCanMakeAdmin(u||{})||settingsActivePage!=='access';");
  const renderAnchor="if($('developerAccountControls'))$('developerAccountControls').hidden=!isDev;";
  if(source.includes(renderAnchor)&&!source.includes(renderAnchor+'renderDeveloperMakeAdminControl(users,isDev);'))source=source.replace(renderAnchor,renderAnchor+'renderDeveloperMakeAdminControl(users,isDev);');
  const bindAnchor="$('developerCreateAccount')?.addEventListener('click',developerCreateAccountUi);";
  if(source.includes(bindAnchor)&&!source.includes("$('developerMakeAdminBtn')?.addEventListener('click',developerMakeAdminUi);"))source=source.replace(bindAnchor,"$('developerMakeAdminBtn')?.addEventListener('click',developerMakeAdminUi);\n    "+bindAnchor);
  if(!source.includes('assurance_regent_browser_developer_make_admin')||!source.includes('executiveAdministratorCanMakeAdmin')||!source.includes('company===actorCompany')||!source.includes("developerMakeAdminBtn')?.addEventListener"))throw new Error(`Make administrator runtime patch incomplete in ${basename(file)}.`);
  if(source!==original)writeFileSync(file,source,'utf8');
  console.log(`[make-admin] ${basename(file)} developer=system-wide company-ceo=own-company`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
