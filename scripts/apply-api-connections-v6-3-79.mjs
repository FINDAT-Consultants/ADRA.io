import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/api-connections-v6-3-79-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('API connections v6.3.79 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.79 — Developer-only API connections \+ platform-wide connector sharing START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.79 — Developer-only API connections \+ platform-wide connector sharing END \*\//u;
for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  if(block.test(s))s=s.replace(block,runtime);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`API connections runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,runtime+'\n\n'+anchor);}
  for(const token of ['API_CONNECTIONS_PAGE79','settingsApiConnectionsSection79','apiConnectionsDeveloper79','connectPlatformGoogle79','platform-wide','renderGmailProfile77=function(){removeLegacyApiConnectionUi79();};','renderMeetInterviewAssistant78=async function','Contact the Developer.'])if(!s.includes(token))throw new Error(`API connections v6.3.79 missing ${token} in ${basename(file)}.`);
  if(/GOCSPX-[A-Za-z0-9_-]{10,}/u.test(s))throw new Error(`Security regression: Google client secret leaked into ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`API connections v6.3.79 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[api-connections] ${basename(file)} developer-only=enabled platform-sharing=enabled`);
}