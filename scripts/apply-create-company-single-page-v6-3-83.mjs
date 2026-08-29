import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/create-company-single-page-v6-3-83-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Create Company single-page v6.3.83 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.83 — single-page Developer Create Company currency selection START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.83 — single-page Developer Create Company currency selection END \*\//u;
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.82 — interview, settings, costing and company creation polish END */';
    if(!source.includes(anchor))throw new Error(`Create Company single-page fix requires v6.3.82 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['singlePageCurrency83','developer-company-profile-row83','developerCompanyCurrencyOptions83','>Submit</button>','billingCurrency:currencyRow.currency'])if(!source.includes(token))throw new Error(`Create Company single-page v6.3.83 missing ${token} in ${basename(file)}.`);
  if(source.indexOf('Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START')<source.indexOf('Assurance Regent v6.3.82 — interview, settings, costing and company creation polish START'))throw new Error(`Create Company v6.3.83 runtime order is invalid in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Create Company v6.3.83 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
  console.log(`[create-company-v83] ${basename(file)} single-page=enabled currency-inline=enabled submit=enabled`);
}
