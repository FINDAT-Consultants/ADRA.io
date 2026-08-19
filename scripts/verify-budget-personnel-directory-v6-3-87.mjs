import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd();
const files={
  app:resolve(root,'app.js'),
  runtime:resolve(root,'scripts/budget-personnel-directory-v6-3-87-runtime.inc.js'),
  migration:resolve(root,'supabase/BUDGET_PERSONNEL_DIRECTORY_V6_3_87.sql')
};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Budget personnel v6.3.87 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),sql=readFileSync(files.migration,'utf8');
for(const token of ['BUDGET_PERSONNEL_SCHEMA87','Personnel Directory','Developer account is excluded','budgetCategory','EMPLOYEE'])if(!app.includes(token))throw new Error(`Built app is missing budget personnel v6.3.87 token: ${token}`);
for(const token of ['Personnel Directory','Country Director, HR, Finance, managers, executives, supervisors and ordinary employees','Project Budget','Personnel Rates','Donor Rules'])if(!runtime.includes(token))throw new Error(`Budget personnel runtime missing ${token}`);
if(runtime.includes("['E001','FIN-010',100"))throw new Error('Fake E001 rate sample must not be included in the downloadable workbook.');
for(const token of ['assurance_regent_browser_budget_personnel_exists','assurance_regent_browser_budget_personnel_directory',"state_value->'auth'->'accounts'",'budgetCategory','EMPLOYEE','UNKNOWN_PERSONNEL','ALL_APPROVED_COMPANY_ACCOUNTS_EXCEPT_DEVELOPER'])if(!sql.includes(token))throw new Error(`Budget personnel migration missing ${token}`);
if(!sql.includes("lower(trim(coalesce(a->>'role',''))) <> 'developer'"))throw new Error('Developer role must be explicitly excluded from budget personnel.');
if(!sql.includes("upper(trim(coalesce(a->>'approvalStatus','APPROVED')))='APPROVED'"))throw new Error('Only approved company accounts should enter the budget personnel directory.');
console.log('[verify-budget-personnel-v87] PASS all approved company accounts are budget personnel, Developer excluded, real personnel directory exported, fake E001 removed.');
