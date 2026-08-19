import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/mic-feedback-recovery-v6-3-104-agent-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Mic feedback recovery v6.3.104 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.104 — reliable manual mic capture \+ feedback recovery START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.104 — reliable manual mic capture \+ feedback recovery END \*\//u;
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.103 — manual microphone means deliberate user instruction END */';
    if(!source.includes(anchor))throw new Error(`Mic feedback recovery v6.3.104 requires v6.3.103 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['MIC_FEEDBACK_RECOVERY_SCHEMA104','manualMicImmediateCapture:true','MANUAL_CAPTURE_GRACE_MS104=2600','TRANSCRIBE_TIMEOUT_MS104=18000','SEND_TIMEOUT_MS104=30000','autoResumeConversation:false','Audio captured · understanding what you said','finishConversationTurn=async function','startConversationMonitor=async function'])if(!source.includes(token))throw new Error(`Mic feedback recovery runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Mic feedback recovery syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!targets.some(existsSync))throw new Error('No Jivan runtime found for mic feedback recovery v6.3.104.');
console.log('[mic-feedback-recovery-v6-3-104] manual capture=guaranteed feedback=staged timeouts=recovering auto-resume=off notifications=silent');
await import('./verify-mic-feedback-recovery-v6-3-104.mjs');
await import('./apply-recruitment-selections-v6-3-105.mjs');
