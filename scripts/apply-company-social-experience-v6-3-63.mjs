import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'company-social-experience-v6-3-63.css'),compactCss=resolve(root,'company-social-analytics-compact-v6-3-64.css'),cardCss=resolve(root,'company-developer-card-action-v6-3-65.css'),directoryCss=resolve(root,'company-developer-directory-create-v6-3-66.css'),profileCss=resolve(root,'company-profile-edit-authority-v6-3-67.css'),runtime=resolve(root,'scripts/company-social-experience-v6-3-63-runtime.inc.js'),cardRuntime=resolve(root,'scripts/company-developer-card-action-v6-3-65-runtime.inc.js'),directoryRuntime=resolve(root,'scripts/company-developer-directory-create-v6-3-66-runtime.inc.js'),profileRuntime=resolve(root,'scripts/company-profile-edit-authority-v6-3-67-runtime.inc.js');
if(!existsSync(css)||!existsSync(compactCss)||!existsSync(cardCss)||!existsSync(directoryCss)||!existsSync(profileCss)||!existsSync(runtime)||!existsSync(cardRuntime)||!existsSync(directoryRuntime)||!existsSync(profileRuntime))throw new Error('Company social/profile experience assets are missing.');
if(existsSync(publicDir)){
  writeFileSync(join(publicDir,'company-social-experience-v6-3-63.css'),readFileSync(css,'utf8'),'utf8');
  writeFileSync(join(publicDir,'company-social-analytics-compact-v6-3-64.css'),readFileSync(compactCss,'utf8'),'utf8');
  writeFileSync(join(publicDir,'company-developer-card-action-v6-3-65.css'),readFileSync(cardCss,'utf8'),'utf8');
  writeFileSync(join(publicDir,'company-developer-directory-create-v6-3-66.css'),readFileSync(directoryCss,'utf8'),'utf8');
  writeFileSync(join(publicDir,'company-profile-edit-authority-v6-3-67.css'),readFileSync(profileCss,'utf8'),'utf8');
}

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/company-social-experience-v6-3-63\.css\?v=[^"]+" \/>/gu,'')
    .replace(/\s*<link rel="stylesheet" href="\.\/company-social-analytics-compact-v6-3-64\.css\?v=[^"]+" \/>/gu,'')
    .replace(/\s*<link rel="stylesheet" href="\.\/company-developer-card-action-v6-3-65\.css\?v=[^"]+" \/>/gu,'')
    .replace(/\s*<link rel="stylesheet" href="\.\/company-developer-directory-create-v6-3-66\.css\?v=[^"]+" \/>/gu,'')
    .replace(/\s*<link rel="stylesheet" href="\.\/company-profile-edit-authority-v6-3-67\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./company-social-experience-v6-3-63.css?v=6.3.63" />\n  <link rel="stylesheet" href="./company-social-analytics-compact-v6-3-64.css?v=6.3.64" />\n  <link rel="stylesheet" href="./company-developer-card-action-v6-3-65.css?v=6.3.65" />\n  <link rel="stylesheet" href="./company-developer-directory-create-v6-3-66.css?v=6.3.66" />\n  <link rel="stylesheet" href="./company-profile-edit-authority-v6-3-67.css?v=6.3.67" />',anchor='<link rel="stylesheet" href="./department-hub-stories-trending.css?v=6.3.62" />';
  if(s.includes(anchor))s=s.replace(anchor,anchor+'\n'+link);else s=s.replace('</head>',link+'\n</head>');
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[company-social-experience] ${basename(file)} developer-company-directory=create+edit profile-owner-contact=enabled`);
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd(),cardAddon=readFileSync(cardRuntime,'utf8').trimEnd(),directoryAddon=readFileSync(directoryRuntime,'utf8').trimEnd(),profileAddon=readFileSync(profileRuntime,'utf8').trimEnd();
  const block=/  \/\* Assurance Regent v6\.3\.63 — compact trend chart, status carousel and developer company selector START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.63 — compact trend chart, status carousel and developer company selector END \*\//u,
    cardBlock=/  \/\* Assurance Regent v6\.3\.65 — developer company card action-only refinement START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.65 — developer company card action-only refinement END \*\//u,
    directoryBlock=/  \/\* Assurance Regent v6\.3\.66 — Developer Companies directory creation hub START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.66 — Developer Companies directory creation hub END \*\//u,
    profileBlock=/  \/\* Assurance Regent v6\.3\.67 — governed company\/profile completion START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.67 — governed company\/profile completion END \*\//u,
    anchor='  function renderExtendedProfileFields()';
  if(block.test(s))s=s.replace(block,addon);else{if(!s.includes(anchor))throw new Error(`v6.3.63 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon+'\n'+anchor);}
  if(cardBlock.test(s))s=s.replace(cardBlock,cardAddon);else{if(!s.includes(anchor))throw new Error(`v6.3.65 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,cardAddon+'\n'+anchor);}
  if(directoryBlock.test(s))s=s.replace(directoryBlock,directoryAddon);else{if(!s.includes(anchor))throw new Error(`v6.3.66 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,directoryAddon+'\n'+anchor);}
  if(profileBlock.test(s))s=s.replace(profileBlock,profileAddon);else{if(!s.includes(anchor))throw new Error(`v6.3.67 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,profileAddon+'\n'+anchor);}

  const profilePayload="const payload={name:$('profileDisplayName')?.value.trim()||'',email:$('profileEmail')?.value.trim()||'',profilePhoto:safeProfilePhoto(state.profilePhotoData)};";
  if(s.includes(profilePayload))s=s.replace(profilePayload,"const payload={name:$('profileDisplayName')?.value.trim()||'',email:$('profileEmail')?.value.trim()||'',phone:$('profilePhone67')?.value.trim()||'',profilePhoto:safeProfilePhoto(state.profilePhotoData)};");
  else if(!s.includes("phone:$('profilePhone67')?.value.trim()||''"))throw new Error(`v6.3.67 self-profile phone payload anchor missing in ${basename(file)}.`);
  const profileValidation="if(!payload.name)return toast('Display name is required.');if(payload.name.length>120)return toast('Display name is too long.');if(payload.email&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(payload.email))return toast('Enter a valid email address.');";
  if(s.includes(profileValidation))s=s.replace(profileValidation,profileValidation+"if(payload.phone.length>40)return toast('Contact number is too long.');");
  else if(!s.includes("payload.phone.length>40"))throw new Error(`v6.3.67 self-profile phone validation anchor missing in ${basename(file)}.`);
  const profileRpc="p_email:payload.email,p_profile_photo:payload.profilePhoto";
  if(s.includes(profileRpc))s=s.replace(profileRpc,"p_email:payload.email,p_profile_photo:payload.profilePhoto,p_phone:payload.phone");
  else if(!s.includes('p_phone:payload.phone'))throw new Error(`v6.3.67 self-profile phone RPC anchor missing in ${basename(file)}.`);
  const accessRpc="p_supervisory_role:supervisoryRole});";
  if(s.includes(accessRpc))s=s.replace(accessRpc,"p_supervisory_role:supervisoryRole,p_email:$('accessEmail67')?.value.trim()||'',p_phone:$('accessPhone67')?.value.trim()||''});");
  else if(!s.includes("p_email:$('accessEmail67')?.value.trim()||''"))throw new Error(`v6.3.67 managed-user contact RPC anchor missing in ${basename(file)}.`);

  for(const token of ['companyHubRenderTrending63','companyHubRenderStories63','renderDeveloperCompanySelector63','renderDeveloperCompanySelectorBase65','renderDeveloperCompanySelectorBase66','renderDeveloperCompanySelectorBase67','data-developer-company-open63','data-developer-company-create66','createDeveloperCompany66','newCompanyLogo66','companyLogoFileId','renderDataCompanyControlsBase66','companyProfileEditDialog67','data-company-profile-edit67','assurance_regent_browser_company_profile_update','profilePhone67','accessEmail67','accessPhone67','p_phone:payload.phone'])if(!s.includes(token))throw new Error(`company/profile runtime missing ${token} in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[company-social-experience] ${basename(file)} company-profile-edit=developer+administrator user-contact=self+managed`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
