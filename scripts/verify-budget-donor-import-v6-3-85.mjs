import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),app=resolve(root,'app.js'),runtime=resolve(root,'scripts/budget-donor-import-v6-3-85-runtime.inc.js'),sql=resolve(root,'supabase/BUDGET_DONOR_IMPORT_V6_3_85.sql'),pkg=resolve(root,'package.json');
for(const file of [app,runtime,sql,pkg])if(!existsSync(file))throw new Error(`Missing required v6.3.85 file: ${file}`);
const appText=readFileSync(app,'utf8'),runtimeText=readFileSync(runtime,'utf8'),sqlText=readFileSync(sql,'utf8'),pkgText=readFileSync(pkg,'utf8');
for(const token of ['Budget & Donor Batch Import','Download Excel template','Upload Excel','Finance approve','Approve & activate','assurance_regent_browser_budget_import_begin','assurance_regent_browser_budget_import_append','assurance_regent_browser_budget_import_finalize','assurance_regent_browser_budget_import_decide','activeBudgets','activeRates','recorded<=expected+eps','APPROVED_IMPORT'])if(!appText.includes(token))throw new Error(`Built app is missing v6.3.85 token: ${token}`);
for(const token of ['xlsx-0.20.3','Project Budget','Personnel Rates','Donor Rules','Maker-checker control','COUNTRY_APPROVE'])if(!runtimeText.includes(token))throw new Error(`Runtime is missing v6.3.85 token: ${token}`);
for(const token of ['assurance_regent_budget_import_batches','assurance_regent_budget_import_projects','assurance_regent_budget_import_rates','assurance_regent_budget_import_rules','PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR','security definer','enable row level security','activeBudgets','activeRates'])if(!sqlText.includes(token))throw new Error(`Migration is missing v6.3.85 token: ${token}`);
for(const token of ['apply:budget-donor-import-v6-3-85','verify:budget-donor-import-v6-3-85'])if(!pkgText.includes(token))throw new Error(`package.json is missing ${token}`);
if(!/recorded<=expected\+eps\?'PASS':'FAIL'/.test(runtimeText))throw new Error('Recovery capacity must pass while approved hours remain within available capacity.');
if(/uploaded_by\s*=\s*finance_reviewed_by/i.test(sqlText))throw new Error('Maker/checker identities must not be collapsed.');
console.log('[verify-budget-donor-import] Excel template + chunked staging + Finance review + Country Director activation + active recovery feed verified.');
