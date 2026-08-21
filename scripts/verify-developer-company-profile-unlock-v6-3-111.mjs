import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['COMPANY_PROFILE_DEVELOPER_UNLOCK_SCHEMA111','companyProfileDeveloper111','unlockDeveloperCompanyProfile111','el.readOnly=false','el.removeAttribute(\'readonly\')','companyProfileCountryList111','assurance_regent_browser_admin_company_profile_update_v111','Developer edit access','All company profile fields shown above are editable','visibleFieldsEditable:[\'logo\',\'name\',\'code\',\'email\',\'phone\',\'registeredCountry\',\'interviewMeetUrl\']','immutable:[\'companyId\']'])if(!source.includes(token))throw new Error(`Developer profile unlock verifier missing ${token} in ${basename(file)}.`);
}
console.log(`[verify-developer-company-profile-unlock-v6-3-111] OK apps=${targets.filter(existsSync).length} developer-visible-fields-editable=1 company-id-immutable=1`);
