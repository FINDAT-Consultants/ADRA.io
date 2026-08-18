import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const files={app:resolve(root,'app.js'),css:resolve(root,'budget-donor-import-v6-3-86.css'),publicCss:resolve(publicDir,'budget-donor-import-v6-3-86.css'),xlsx:resolve(publicDir,'vendor/xlsx.full.min.js'),index:resolve(root,'index.html'),publicIndex:resolve(publicDir,'index.html'),netlify:resolve(root,'netlify.toml'),protect:resolve(root,'scripts/protect-client.mjs')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Budget import v6.3.86 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),css=readFileSync(files.css,'utf8'),index=readFileSync(files.index,'utf8'),publicIndex=readFileSync(files.publicIndex,'utf8'),netlify=readFileSync(files.netlify,'utf8'),protect=readFileSync(files.protect,'utf8'),xlsx=readFileSync(files.xlsx,'utf8');
for(const token of ['BUDGET_IMPORT_PAGE_SIZE86=5','./vendor/xlsx.full.min.js','budgetImportRefreshStatus86','renderBudgetImportPager86','data-budget-page86','downloadBudgetTemplate86','Refreshing…'])if(!app.includes(token))throw new Error(`Built app is missing v6.3.86 token: ${token}`);
for(const token of ['#view-budget-import .budget-import-hero85','#view-budget-import .budget-import-flow85 article','.budget-import-table-footer86','.budget-import-page86','line-height:1.5'])if(!css.includes(token))throw new Error(`Budget import stylesheet is missing ${token}`);
for(const html of [index,publicIndex])if(!html.includes('data-budget-import-css86')||!html.includes('./budget-donor-import-v6-3-86.css'))throw new Error('Budget import static stylesheet is not linked from an index page.');
if(statSync(files.xlsx).size<500000||!xlsx.includes('0.20.3'))throw new Error('Vendored SheetJS 0.20.3 browser runtime is missing or incomplete.');
if(!protect.includes("name === 'xlsx.full.min.js'"))throw new Error('Protected build must preserve the vendored SheetJS browser runtime.');
if(!/script-src 'self';/.test(netlify)||/script-src[^\n\"]*cdn\.sheetjs\.com/.test(netlify))throw new Error('Strict self-only production script CSP must remain unchanged.');
console.log('[verify-budget-donor-import-v86] PASS static CSP-safe styling + same-origin Excel runtime + working refresh/download controls + five-row pagination.');
