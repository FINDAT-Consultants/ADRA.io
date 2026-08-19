import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/budget-approval-workflow-v6-3-88-runtime.inc.js'),migration:resolve(root,'supabase/BUDGET_APPROVAL_WORKFLOW_V6_3_88.sql')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Budget approval v6.3.88 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),sql=readFileSync(files.migration,'utf8');
for(const token of ['BUDGET_APPROVAL_SCHEMA88','Finance Officer / Accountant uploads','Approve → Country Director','Approve & Activate','Return for correction','budget_import','mergeBudgetImportNotificationsIntoControl88','FINANCE_OFFICE','FINANCE_MANAGER','COUNTRY_DIRECTOR'])if(!app.includes(token))throw new Error(`Built app is missing budget approval v6.3.88 token: ${token}`);
for(const token of ['previewPermissionsBase88','budgetFinanceMaker88','budgetFinanceReviewer88','budgetCountryApprover88','assurance_regent_browser_budget_import_notification_read','Budget approvals','Open budget','Mark read'])if(!runtime.includes(token))throw new Error(`Budget approval runtime missing ${token}`);
for(const token of ['assurance_regent_budget_import_notifications','FINANCE_REVIEW_REQUIRED','COUNTRY_APPROVAL_REQUIRED','BUDGET_RETURNED','BUDGET_REJECTED','BUDGET_ACTIVATED','FINANCE_REVIEW_COMPLETED','assurance_regent_browser_budget_import_notify_stage88','assurance_regent_browser_budget_import_notification_read','FINANCE_OFFICER_TO_FINANCE_MANAGER_TO_COUNTRY_DIRECTOR'])if(!sql.includes(token))throw new Error(`Budget approval migration missing ${token}`);
if(!sql.includes("descriptor ~ '(accountant|accounting officer|accounts officer|accounts assistant|finance officer|finance assistant|finance analyst|budget officer|grants accountant|project accountant)'"))throw new Error('Finance Office maker titles are not enforced.');
if(!sql.includes("descriptor !~ '(finance manager|finance director|head of finance|chief financial officer|cfo)'"))throw new Error('Finance Manager must be excluded from the normal maker role.');
if(sql.includes("in ('DEVELOPER','CEO','ADMINISTRATOR','FINANCE_MANAGER')"))throw new Error('Legacy broad budget uploader authority remains in v6.3.88 migration.');
if(!sql.includes("v_actor_id in (v_batch.uploaded_by,coalesce(v_batch.finance_reviewed_by,''))"))throw new Error('Independent Country Director approval control is missing.');
if(!sql.includes("revoke all on table public.assurance_regent_budget_import_notifications from anon, authenticated"))throw new Error('Budget notification table must remain private.');
console.log('[verify-budget-approval-v88] PASS Finance Office maker -> Finance Manager checker -> Country Director approver, role visibility and targeted bell notifications.');

await import('./verify-recovery-voucher-v6-3-89.mjs');
