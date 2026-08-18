import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/budget-donor-import-v6-3-85-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Budget & Donor import v6.3.85 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.85 — controlled Budget & Donor Excel imports \+ recovery budget feed START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.85 — controlled Budget & Donor Excel imports \+ recovery budget feed END \*\//u;
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking END */';
    if(!source.includes(anchor))throw new Error(`Budget & Donor import v6.3.85 requires v6.3.84 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['data-budget-template85','Budget & Donor Batch Import','assurance_regent_browser_budget_import_begin','assurance_regent_browser_budget_import_append','assurance_regent_browser_budget_import_finalize','assurance_regent_browser_budget_import_decide','PENDING_FINANCE_REVIEW','PENDING_COUNTRY_DIRECTOR','activeBudgets','activeRates','recorded<=expected+eps','Download Excel template'])if(!source.includes(token))throw new Error(`Budget & Donor import v6.3.85 missing ${token} in ${basename(file)}.`);
  if(source.indexOf('Assurance Regent v6.3.85 — controlled Budget & Donor Excel imports + recovery budget feed START')<source.indexOf('Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking START'))throw new Error(`Budget & Donor import runtime order is invalid in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Budget & Donor import syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
  console.log(`[budget-donor-import] ${basename(file)} staged-excel=enabled maker-checker=enabled recovery-budget-feed=enabled`);
}
