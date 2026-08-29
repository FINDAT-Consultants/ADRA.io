import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimePath=resolve(root,'scripts/developer-company-profile-unlock-v6-3-111-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Developer company profile unlock runtime v6.3.111 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.111 — Developer full company profile edit START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.111 — Developer full company profile edit END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.110 — Developer company master edit END */';if(!source.includes(anchor))throw new Error(`Developer profile unlock requires v6.3.110 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['COMPANY_PROFILE_DEVELOPER_UNLOCK_SCHEMA111','unlockDeveloperCompanyProfile111','companyProfileCode67','companyProfileCountry67','companyProfileMeet67','assurance_regent_browser_admin_company_profile_update_v111','visibleFieldsEditable','immutable:[\'companyId\']'])if(!source.includes(token))throw new Error(`Developer profile unlock runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Developer profile unlock syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);if(source!==before)writeFileSync(file,source,'utf8');
}
console.log(`[developer-company-profile-unlock-v6-3-111] apps=${targets.filter(existsSync).length} visible-fields=unlocked developer-only=1 company-id-immutable=1`);
await import('./verify-developer-company-profile-unlock-v6-3-111.mjs');
await import('./apply-developer-company-country-dropdown-v6-3-112.mjs');
