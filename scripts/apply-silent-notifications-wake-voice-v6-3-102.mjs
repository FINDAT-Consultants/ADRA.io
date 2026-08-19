import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/silent-notifications-wake-voice-v6-3-102-agent-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Silent notifications/wake voice v6.3.102 runtime is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.102 — silent notifications \+ addressed voice wake START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.102 — silent notifications \+ addressed voice wake END \*\//u;
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.101 — minimal AI reminders END */';
    if(!source.includes(anchor))throw new Error(`Silent notifications/wake voice v6.3.102 requires v6.3.101 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['SILENT_NOTIFICATION_WAKE_SCHEMA102','VOICE_WAKE_WINDOW_MS102=90*1000','voiceAddressed102','notificationsSpoken:false','backgroundAudioRoutedToAgent:false','idleRequiresAddress:true','runProactive=async function','finishConversationTurn=async function','startConversationMonitor=async function'])if(!source.includes(token))throw new Error(`Silent notification/wake voice runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Silent notification/wake voice syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!targets.some(existsSync))throw new Error('No Jivan runtime found for v6.3.102.');
console.log('[silent-notifications-wake-voice-v6-3-102] notifications=silent wake=Jivan/Jeevan/Zari ambient-routing=blocked engaged-window=90s');
await import('./verify-silent-notifications-wake-voice-v6-3-102.mjs');
await import('./apply-manual-mic-direct-response-v6-3-103.mjs');
