import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const appRuntimeFile=resolve(root,'scripts/zari-jivan-shared-voice-v6-3-98-app-runtime.inc.js');
const agentRuntimeFile=resolve(root,'scripts/zari-jivan-shared-voice-v6-3-98-agent-runtime.inc.js');
if(!existsSync(appRuntimeFile)||!existsSync(agentRuntimeFile))throw new Error('Zari/Jivan voice v6.3.98 runtime files are missing.');
const appRuntime=readFileSync(appRuntimeFile,'utf8').trimEnd(),agentRuntime=readFileSync(agentRuntimeFile,'utf8').trimEnd();
const appBlock=/  \/\* Assurance Regent v6\.3\.98 — (?:shared Zari\/Jivan synthetic voice|exact Zari sign-in voice bridge) START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.98 — (?:shared Zari\/Jivan synthetic voice|exact Zari sign-in voice bridge) END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.3\.98 — Jivan uses (?:Zari synthetic voice|exact Zari sign-in voice) START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.98 — Jivan uses (?:Zari synthetic voice|exact Zari sign-in voice) END \*\//u;
const appTargets=[resolve(root,'app.js')],agentTargets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentTargets.push(join(publicDir,name));
}
for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(appBlock.test(source))source=source.replace(appBlock,appRuntime);else{
    const anchor='  /* Assurance Regent v6.3.96 — guaranteed Work Status sidebar END */';
    if(!source.includes(anchor))throw new Error(`Zari/Jivan voice v6.3.98 requires v6.3.96 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${appRuntime}`);
  }
  for(const token of ['ZARI_SHARED_VOICE_SCHEMA98','zariSignInSpeakBase98=speakAuthPrompt','zariSharedSpeak98','EXACT_SIGNIN_HANDOFF','AssuranceRegentZariVoice'])if(!source.includes(token))throw new Error(`Exact Zari sign-in voice app runtime missing ${token} in ${basename(file)}.`);
  if(source.includes('resolveZariSharedVoice98'))throw new Error(`Legacy voice selector still present in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Exact Zari sign-in voice app syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
for(const file of agentTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(agentBlock.test(source))source=source.replace(agentBlock,agentRuntime);else{
    const close=source.lastIndexOf('\n})();');if(close<0)throw new Error(`Could not locate Jivan runtime closure in ${basename(file)}.`);
    source=`${source.slice(0,close)}\n\n${agentRuntime}${source.slice(close)}`;
  }
  for(const token of ['JIVAN_ZARI_VOICE_SCHEMA98','jivanSpeakBase98','AssuranceRegentZariVoice','channel:\'JIVAN\'','AssuranceRegentJivanVoiceBridge','EXACT_ZARI_SIGNIN_HANDOFF_VOICE'])if(!source.includes(token))throw new Error(`Jivan exact Zari sign-in voice runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Jivan exact Zari sign-in voice syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!agentTargets.some(existsSync))throw new Error('No Jivan runtime was found for Zari sign-in voice v6.3.98.');
console.log('[zari-jivan-voice-v98] Zari sign-in/handoff voice=exact Jivan speech=direct-path no-separate-voice-selector fallback=existing-Jivan-voice');
await import('./verify-zari-jivan-shared-voice-v6-3-98.mjs');
await import('./verify-zari-jivan-voice-contract-v6-3-99.mjs');
