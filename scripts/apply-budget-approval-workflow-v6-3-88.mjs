import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/budget-approval-workflow-v6-3-88-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Budget approval workflow v6.3.88 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.88 — budget maker\/checker\/approver workflow \+ notifications START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.88 — budget maker\/checker\/approver workflow \+ notifications END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.87 — unified budget personnel directory + safe template END */';
    if(!source.includes(anchor))throw new Error(`Budget approval workflow v6.3.88 requires v6.3.87 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['BUDGET_APPROVAL_SCHEMA88','Finance Officer / Accountant uploads','Approve → Country Director','Approve & Activate','Return for correction','budget_import','mergeBudgetImportNotificationsIntoControl88','assurance_regent_browser_budget_import_notification_read','FINANCE_OFFICE','COUNTRY_DIRECTOR'])if(!source.includes(token))throw new Error(`Budget approval workflow v6.3.88 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Budget approval workflow v6.3.88 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[budget-approval-v88] finance-office=maker finance-manager=checker country-director=approver notifications=targeted rbac=role-scoped');
