import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/gmail-oauth-v6-3-77-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Gmail OAuth v6.3.77 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.77 — Gmail OAuth outbound email integration START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.77 — Gmail OAuth outbound email integration END \*\//u;
for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  if(block.test(s))s=s.replace(block,runtime);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Gmail OAuth runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,runtime+'\n\n'+anchor);}
  for(const token of ['GMAIL_OAUTH_REDIRECT_URI77','baseSupabaseFunction77','gmailConnectorRequest77','ensureGmailConnected77','gmail-connector',"name==='recruitment-public'", "payload?.channel||'').toLowerCase()==='email'", "name==='recovery-agent'", "payload?.channel||'').toUpperCase()==='EMAIL'",'data-gmail-connect77','assurance-regent-gmail-connected',"provider:'GMAIL'"])if(!s.includes(token))throw new Error(`Gmail OAuth v6.3.77 missing ${token} in ${basename(file)}.`);
  if(/GOCSPX-/u.test(s))throw new Error(`Security regression: Gmail OAuth client secret leaked into ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Gmail OAuth v6.3.77 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[gmail-oauth] ${basename(file)} recruitment-email=Gmail jivan-email=Gmail secret=server-only`);
}
