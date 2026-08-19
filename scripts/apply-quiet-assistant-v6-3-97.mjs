import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const appRuntimeFile=resolve(root,'scripts/quiet-assistant-v6-3-97-app-runtime.inc.js');
const agentRuntimeFile=resolve(root,'scripts/quiet-assistant-v6-3-97-agent-runtime.inc.js');
if(!existsSync(appRuntimeFile)||!existsSync(agentRuntimeFile))throw new Error('Quiet assistant v6.3.97 runtime files are missing.');
const appRuntime=readFileSync(appRuntimeFile,'utf8').trimEnd(),agentRuntime=readFileSync(agentRuntimeFile,'utf8').trimEnd();
const appBlock=/  \/\* Assurance Regent v6\.3\.97 — quiet assistant \+ interval notifications START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.97 — quiet assistant \+ interval notifications END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.3\.97 — quiet explicit-invocation assistant START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.97 — quiet explicit-invocation assistant END \*\//u;

const appTargets=[resolve(root,'app.js')];
const agentTargets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentTargets.push(join(publicDir,name));
}
for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(appBlock.test(source))source=source.replace(appBlock,appRuntime);else{
    const anchor='  /* Assurance Regent v6.3.96 — guaranteed Work Status sidebar END */';
    if(!source.includes(anchor))throw new Error(`Quiet assistant v6.3.97 requires v6.3.96 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${appRuntime}`);
  }
  for(const token of ['QUIET_ASSISTANT_SCHEMA97','QUIET_NOTIFICATION_INTERVAL_MS97=30*60*1000','quietScheduleNotifications97','assurance-regent-notifications-digest','lastAgentNotificationCount=u?n:-1','Jivan is available when you request a task'])if(!source.includes(token))throw new Error(`Quiet assistant app runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Quiet assistant app syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
for(const file of agentTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(agentBlock.test(source))source=source.replace(agentBlock,agentRuntime);else{
    const close=source.lastIndexOf('\n})();');if(close<0)throw new Error(`Could not locate Jivan runtime closure in ${basename(file)}.`);
    source=`${source.slice(0,close)}\n\n${agentRuntime}${source.slice(close)}`;
  }
  for(const token of ['QUIET_AGENT_SCHEMA97','quietVoiceInvocation97','explicit_invocation_required','runProactive=async function(){return null;}','resumeConversation:false','autoStartGranted:false','Ambient conversation ignored','quietSpeechPermitUntil97'])if(!source.includes(token))throw new Error(`Quiet assistant agent runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Quiet assistant agent syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!agentTargets.some(existsSync))throw new Error('No Jivan recovery-agent runtime was found for quiet assistant v6.3.97.');
console.log('[quiet-assistant-v97] notifications=30m-digest proactive-speech=off automatic-mic-resume=off ambient-voice=name+request-only');
await import('./verify-quiet-assistant-v6-3-97.mjs');
