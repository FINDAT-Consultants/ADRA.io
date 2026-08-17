import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/meet-interview-assistant-v6-3-78-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Meet interview assistant v6.3.78 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.78 — Google Meet Jivan interview assistant START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.78 — Google Meet Jivan interview assistant END \*\//u;
for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  if(block.test(s))s=s.replace(block,runtime);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Meet interview assistant runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,runtime+'\n\n'+anchor);}
  for(const token of ['MEET_READ_SCOPE78','meet-interview-assistant','authorizeMeetScope78','data-jivan-interview-notes78','data-meet-compare78','baseRenderRecruiting78','Advisory evidence only'])if(!s.includes(token))throw new Error(`Meet interview assistant v6.3.78 missing ${token} in ${basename(file)}.`);
  if(/AIzaSy[A-Za-z0-9_-]{20,}/u.test(s))throw new Error(`Security regression: Google API key leaked into ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Meet interview assistant v6.3.78 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[meet-interview-assistant] ${basename(file)} transcript-notes=enabled evidence-comparison=human-decision`);
}
