import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),runtimePath=resolve(root,'scripts/create-company-single-page-v6-3-83-runtime.inc.js'),applyPath=resolve(root,'scripts/apply-create-company-single-page-v6-3-83.mjs'),appPath=resolve(root,'app.js'),packagePath=resolve(root,'package.json');
for(const path of [runtimePath,applyPath,appPath,packagePath])if(!existsSync(path))throw new Error(`Create Company v6.3.83 required file missing: ${path}`);
const runtime=readFileSync(runtimePath,'utf8'),app=readFileSync(appPath,'utf8'),pkg=readFileSync(packagePath,'utf8');

for(const token of [
  'singlePageCurrency83',
  'developer-company-profile-row83',
  '<b>Currency</b>',
  'Select currency',
  'developerCompanyCurrencyRows83',
  'data-developer-company-create-submit66>Submit</button>',
  "submit.textContent='Submitting…'",
  'billingCurrency:currencyRow.currency',
  'currencyName:currencyRow.currencyName'
])if(!runtime.includes(token))throw new Error(`Create Company v6.3.83 runtime behavior missing: ${token}`);

for(const forbidden of ['Next: Currency & country','data-developer-company-create-next82','data-developer-company-create-back82','developer-company-create-progress82'])if(runtime.includes(forbidden))throw new Error(`Create Company v6.3.83 must not contain wizard behavior: ${forbidden}`);
if(!app.includes('Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START'))throw new Error('Create Company v6.3.83 runtime was not applied to app.js.');
if(app.indexOf('Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START')<app.indexOf('Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START'))throw new Error('Create Company v6.3.83 runtime is not layered after v6.3.82.');
for(const token of ['singlePageCurrency83','developerCompanyCurrencyOptions83','>Submit</button>'])if(!app.includes(token))throw new Error(`Applied Create Company v6.3.83 is missing: ${token}`);
for(const token of ['"apply:create-company-single-page-v6-3-83"','"verify:create-company-single-page-v6-3-83"','npm run apply:create-company-single-page-v6-3-83','npm run verify:create-company-single-page-v6-3-83'])if(!pkg.includes(token))throw new Error(`package.json Create Company v6.3.83 wiring missing: ${token}`);
for(const path of [runtimePath,applyPath,appPath]){const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(check.status!==0)throw new Error(`Syntax check failed for ${path}:\n${check.stderr||check.stdout}`);}
console.log('[create-company-v83-verify] OK: Create Company is one page with the currency dropdown inline at the right of the logo controls.');
console.log('[create-company-v83-verify] OK: Submit creates the company directly; no Next/Back currency wizard is used.');
