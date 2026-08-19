import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/manual-mic-direct-response-v6-3-103-agent-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Manual microphone response v6.3.103 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.103 — manual microphone means deliberate user instruction START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.103 — manual microphone means deliberate user instruction END \*\//u;
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.102 — silent notifications + addressed voice wake END */';
    if(!source.includes(anchor))throw new Error(`Manual microphone response v6.3.103 requires v6.3.102 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['MANUAL_MIC_RESPONSE_SCHEMA103','startVoiceConversationBeforeManualMic103','voiceWake102();','manualMicStartsEngaged:true','manualMicRequiresWakeName:false','automaticBackgroundRequiresAddress:true','notificationsSpoken:false'])if(!source.includes(token))throw new Error(`Manual microphone response runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Manual microphone response syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!targets.some(existsSync))throw new Error('No Jivan runtime found for manual microphone response v6.3.103.');
console.log('[manual-mic-direct-response-v6-3-103] manual mic=explicit invocation background auto-listening=wake guarded notifications=silent');
await import('./verify-manual-mic-direct-response-v6-3-103.mjs');
await import('./apply-mic-feedback-recovery-v6-3-104.mjs');
