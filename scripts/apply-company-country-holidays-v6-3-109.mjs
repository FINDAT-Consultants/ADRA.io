import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimePath=resolve(root,'scripts/company-country-holidays-v6-3-109-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Company holiday runtime v6.3.109 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.109 — company country\/currency public holiday calendar START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.109 — company country\/currency public holiday calendar END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.107 — force visible Recruiting Selections tab END */';if(!source.includes(anchor))throw new Error(`Company holiday runtime requires v6.3.107 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['COMPANY_HOLIDAY_SCHEMA109','companyHolidayContext109','syncCompanyHolidays109','company-holidays','countryPrimary:true',"currencyFallback:'unique-only'",'officialHolidayStandardHours:0','standardHours:0','Official public holiday ·'])if(!source.includes(token))throw new Error(`Company holiday runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Company holiday syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);if(source!==before)writeFileSync(file,source,'utf8');
}
console.log(`[company-country-holidays-v6-3-109] apps=${targets.filter(existsSync).length} country=primary currency=unique-fallback official-holidays=zero-hours source=Nager.Date`);
await import('./verify-company-country-holidays-v6-3-109.mjs');
await import('./apply-developer-company-master-edit-v6-3-110.mjs');
