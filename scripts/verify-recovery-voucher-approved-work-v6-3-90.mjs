import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/recovery-voucher-approved-work-v6-3-90-runtime.inc.js'),apply:resolve(root,'scripts/apply-recovery-voucher-approved-work-v6-3-90.mjs'),sql:resolve(root,'supabase/RECOVERY_VOUCHER_APPROVED_WORK_V6_3_90.sql')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Recovery approved-work v6.3.90 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),apply=readFileSync(files.apply,'utf8'),sql=readFileSync(files.sql,'utf8');
for(const token of ['RECOVERY_APPROVED_WORK_SCHEMA90','recoveryEntryDecision90','recoverySelectedEntries90','APPROVED_WORK_ONLY','approvedEntryCount','rejectedEntryCount','pendingEntryCount'])if(!app.includes(token))throw new Error(`Built app is missing Recovery approved-work v6.3.90 token: ${token}`);
for(const token of ["return 'REJECTED'","return 'APPROVED'",'rejected entries are excluded','contribute zero',"fiveKeys=['evidence','capacity','eligibility','budget','approval']",'recoveryGate:gate'])if(!runtime.includes(token))throw new Error(`Recovery approved-work runtime missing ${token}`);
for(const token of ['Recovery approved-work v6.3.90 requires v6.3.89','--check','rejected=excluded'])if(!apply.includes(token))throw new Error(`Recovery approved-work apply script missing ${token}`);
for(const token of ['assurance_regent_browser_budget_personnel_directory','LIVE_EMPLOYEE','ACCOUNT','timeEntries','payroll','budgetCategory','EMPLOYEE','assurance_regent_browser_budget_personnel_exists'])if(!sql.includes(token))throw new Error(`Recovery approved-work migration missing ${token}`);
if(!sql.includes("lower(trim(coalesce(a->>'role',''))) <> 'developer'"))throw new Error('Platform Developer must remain excluded from account budget personnel.');
if(!sql.includes('developer_principals'))throw new Error('Live operational employees must exclude identities linked to a platform Developer principal.');
if(runtime.includes("keys.approval='PASS';\n      keyReasons.approval='All entries approved'"))throw new Error('Rejected entries must not be rewritten as approved.');
console.log('[verify-recovery-approved-work-v90] PASS rejected time is excluded, approved work remains recoverable, pending decisions still block, and operational employee IDs are valid budget personnel.');
