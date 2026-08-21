import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimePath=resolve(root,'scripts/developer-company-country-dropdown-v6-3-112-app-runtime.inc.js');
if(!existsSync(runtimePath))throw new Error('Developer country dropdown runtime v6.3.112 is missing.');
const runtime=readFileSync(runtimePath,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.112 — full Developer registered-country dropdown START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.112 — full Developer registered-country dropdown END \*\//u;
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;if(block.test(source))source=source.replace(block,runtime);else{const anchor='  /* Assurance Regent v6.3.111 — Developer full company profile edit END */';if(!source.includes(anchor))throw new Error(`Full country dropdown requires v6.3.111 in ${basename(file)}.`);source=source.replace(anchor,`${anchor}\n\n${runtime}`);}
  for(const token of ['COMPANY_PROFILE_COUNTRY_DROPDOWN_SCHEMA112','companyProfileCountrySelect112','document.createElement(\'select\')','data-country-help112','minimumCountries:195','filteredDatalist:false'])if(!source.includes(token))throw new Error(`Full country dropdown runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Full country dropdown syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);if(source!==before)writeFileSync(file,source,'utf8');
}
console.log(`[developer-company-country-dropdown-v6-3-112] apps=${targets.filter(existsSync).length} control=select min-countries=195 filtered-datalist=0`);
await import('./verify-developer-company-country-dropdown-v6-3-112.mjs');
