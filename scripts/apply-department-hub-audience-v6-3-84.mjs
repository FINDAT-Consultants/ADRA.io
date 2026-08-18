import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/department-hub-audience-v6-3-84-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Department Hub audience v6.3.84 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.84 — Department Hub reactor details \+ unique audience tracking START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.84 — Department Hub reactor details \+ unique audience tracking END \*\//u;
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.83 — single-page Developer Create Company currency selection END */';
    if(!source.includes(anchor))throw new Error(`Department Hub audience v6.3.84 requires v6.3.83 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['data-social-reactions-more84','+ See more','assurance_regent_browser_department_social_reactors','companyHubRecordView62','IntersectionObserver','data-social-comment-form'])if(!source.includes(token))throw new Error(`Department Hub audience v6.3.84 missing ${token} in ${basename(file)}.`);
  if(source.indexOf('Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking START')<source.indexOf('Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START'))throw new Error(`Department Hub audience runtime order is invalid in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Department Hub audience syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
  console.log(`[department-hub-audience] ${basename(file)} reactor-modal=enabled unique-viewers=enabled`);
}
