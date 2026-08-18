import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/operational-ui-v6-3-82-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Operational UI v6.3.82 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.82 — interview, settings, costing and company creation polish START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.82 — interview, settings, costing and company creation polish END \*\//u;
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing END */';
    if(!source.includes(anchor))throw new Error(`Operational UI requires the v6.3.79 API connections runtime in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['ALL_EMPLOYEES_RATE82','Select all employees','Select all projects','Reconnect Google Workspace','data-interview-evidence-actions82','data-rate-delete82','newCompanyCurrencyCountry82','Next: Currency & country','billingCurrency:currencyRow.currency'])if(!source.includes(token))throw new Error(`Operational UI v6.3.82 missing ${token} in ${basename(file)}.`);
  if(source.indexOf('Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START')<source.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START'))throw new Error(`Operational UI runtime order is invalid in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Operational UI syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
  console.log(`[operational-ui] ${basename(file)} interview-header=compact api-buttons=compact costing-editable=enabled company-currency-wizard=enabled`);
}
