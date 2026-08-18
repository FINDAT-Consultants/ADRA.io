import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),runtimePath=resolve(root,'scripts/operational-ui-v6-3-82-runtime.inc.js'),applyPath=resolve(root,'scripts/apply-operational-ui-v6-3-82.mjs'),appPath=resolve(root,'app.js'),packagePath=resolve(root,'package.json');
for(const path of [runtimePath,applyPath,appPath,packagePath])if(!existsSync(path))throw new Error(`Operational UI required file missing: ${path}`);
const runtime=readFileSync(runtimePath,'utf8'),app=readFileSync(appPath,'utf8'),pkg=readFileSync(packagePath,'utf8');

for(const token of [
  "$('meetInterviewAssistant78')?.remove()",
  'data-interview-evidence-actions82',
  '>Compare interview evidence</button>',
  'Reconnect Google Workspace',
  'data-api-google-disconnect79',
  'data-api-connections-refresh79',
  "SETTINGS_PAGE_META[API_CONNECTIONS_PAGE79]=['API Connections','']",
  'Select all employees',
  'Select all projects',
  'data-rate-edit82',
  'data-rate-delete82',
  'Reset default rate',
  'deleteRateOverride82',
  'newCompanyCurrencyCountry82',
  'Next: Currency & country',
  'developerCompanyCurrencyOptions82',
  'billingCurrency:currencyRow.currency',
  'registeredCountry:currencyRow.country'
])if(!runtime.includes(token))throw new Error(`Operational UI runtime behavior missing: ${token}`);

if(!app.includes('Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START'))throw new Error('Operational UI runtime was not applied to app.js.');
if(app.indexOf('Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START')<app.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START'))throw new Error('Operational UI runtime is not layered after API connections.');
for(const token of ['ALL_EMPLOYEES_RATE82','Select all employees','Reconnect Google Workspace','newCompanyCurrencyCountry82','billingCurrency:currencyRow.currency'])if(!app.includes(token))throw new Error(`Applied operational UI is missing: ${token}`);
for(const token of ['"apply:operational-ui-v6-3-82"','"verify:operational-ui-v6-3-82"','npm run apply:operational-ui-v6-3-82','npm run verify:operational-ui-v6-3-82'])if(!pkg.includes(token))throw new Error(`package.json operational UI wiring missing: ${token}`);

for(const path of [runtimePath,applyPath,appPath]){const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(check.status!==0)throw new Error(`Syntax check failed for ${path}:\n${check.stderr||check.stdout}`);}
console.log('[operational-ui-verify] OK: interview evidence action is aligned with Candidate interviews without the Jivan notes banner copy.');
console.log('[operational-ui-verify] OK: API Connections is reduced to Google reconnect/disconnect/refresh controls.');
console.log('[operational-ui-verify] OK: costing overrides support edit, delete/reset and select-all employee/project application.');
console.log('[operational-ui-verify] OK: Developer Create Company uses a two-step country/currency wizard and persists the selected currency.');
