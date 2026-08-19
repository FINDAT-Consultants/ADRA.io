import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/budget-personnel-directory-v6-3-87-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Budget personnel directory v6.3.87 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.87 — unified budget personnel directory \+ safe template START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.87 — unified budget personnel directory \+ safe template END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.86 — Budget & Donor Import UI + control reliability END */';
    if(!source.includes(anchor))throw new Error(`Budget personnel v6.3.87 requires v6.3.86 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['BUDGET_PERSONNEL_SCHEMA87','Personnel Directory','Developer account is excluded','Template downloaded ·','downloadBudgetTemplate86=async function'])if(!source.includes(token))throw new Error(`Budget personnel v6.3.87 missing ${token} in ${basename(file)}.`);
  if(source.includes("['E001','FIN-010',100"))throw new Error(`Unsafe fake E001 personnel sample remains active in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Budget personnel v6.3.87 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
console.log('[budget-personnel-v87] all-approved-company-accounts=budget-personnel developer=excluded personnel-directory-sheet=enabled fake-E001=removed');
