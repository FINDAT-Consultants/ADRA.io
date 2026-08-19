import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/minimal-ai-reminders-v6-3-101-agent-runtime.inc.js');
if(!existsSync(runtimeFile))throw new Error('Minimal AI reminders v6.3.101 runtime file is missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.101 — minimal AI reminders START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.101 — minimal AI reminders END \*\//u;
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.100 — uninterrupted Zari voice for Jivan END */';
    if(!source.includes(anchor))throw new Error(`Minimal reminders v6.3.101 requires v6.3.100 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['MINIMAL_AI_REMINDERS_SCHEMA101','NOTIFICATION_COOLDOWN_MS101=20*60*1000','REMINDER_BREATHING_MS101=5*60*1000','reminderQueueNotifications101','reminderPendingNotifications101','existingBacklogSpokenOnOpen:false','mode:\'PRIORITY_BATCHED\'','runProactive=async function'])if(!source.includes(token))throw new Error(`Minimal reminders runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Minimal reminders syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!targets.some(existsSync))throw new Error('No Jivan runtime found for minimal reminders v6.3.101.');
console.log('[minimal-ai-reminders-v6-3-101] notification cooldown=20m breathing=5m critical gap=5m backlog-on-open=silent badges=immediate');
await import('./verify-minimal-ai-reminders-v6-3-101.mjs');
await import('./apply-silent-notifications-wake-voice-v6-3-102.mjs');
