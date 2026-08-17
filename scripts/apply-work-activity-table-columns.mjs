import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/work-activity-table-columns-v6-3-75-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Work Activity table-column v6.3.75 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.75 — Work Activity table column integrity START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.75 — Work Activity table column integrity END \*\//u;
for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;if(!s.includes('Assurance Regent v6.3.74 — active Job ID self-heal + reliable clock-out'))throw new Error(`v6.3.74 must be applied before v6.3.75 in ${basename(file)}.`);
  if(block.test(s))s=s.replace(block,runtime);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Work Activity v6.3.75 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,runtime+'\n\n'+anchor);}
  for(const token of ['workActivityTableColumnIndexes75','repairWorkActivityIndividualColumns75','baseRenderMtsTable75',"clockOut:find('clock-out','clockout')","progress:find('progress')","hourlyRate:find('hourly-rate')","operationalCost:find('operational-cost')"])if(!s.includes(token))throw new Error(`Work Activity v6.3.75 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Work Activity v6.3.75 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[work-activity-table-columns] ${basename(file)} clock-out=time-only progress=progress-column rate-cost=header-aligned`);
}
