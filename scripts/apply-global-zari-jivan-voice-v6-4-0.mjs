import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const appRuntimeFile=resolve(root,'scripts/global-zari-jivan-voice-v6-4-0-app-runtime.inc.js');
const agentRuntimeFile=resolve(root,'scripts/global-zari-jivan-voice-v6-4-0-agent-runtime.inc.js');
if(!existsSync(appRuntimeFile)||!existsSync(agentRuntimeFile))throw new Error('Global Zari/Jivan voice v6.4.0 runtime files are missing.');
const appRuntime=readFileSync(appRuntimeFile,'utf8').trimEnd(),agentRuntime=readFileSync(agentRuntimeFile,'utf8').trimEnd();
const appBlock=/  \/\* Assurance Regent v6\.4\.0 — global canonical Zari\/Jivan voice START \*\/[\s\S]*?  \/\* Assurance Regent v6\.4\.0 — global canonical Zari\/Jivan voice END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.4\.0 — Jivan canonical global voice START \*\/[\s\S]*?  \/\* Assurance Regent v6\.4\.0 — Jivan canonical global voice END \*\//u;
const appTargets=[resolve(root,'app.js')],agentTargets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentTargets.push(join(publicDir,name));
}
for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(appBlock.test(source))source=source.replace(appBlock,appRuntime);else{
    const anchor='  /* Assurance Regent v6.3.98 — exact Zari sign-in voice bridge END */';
    if(!source.includes(anchor))throw new Error(`Global voice v6.4.0 requires v6.3.98 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${appRuntime}`);
  }
  for(const token of ['GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640','GLOBAL_ZARI_JIVAN_VOICE_NAME640=\'coral\'','jivan-voice','zari-public-voice','AssuranceRegentCanonicalVoice','OPENAI_SERVER_TTS','window.AssuranceRegentZariVoice=window.AssuranceRegentCanonicalVoice'])if(!source.includes(token))throw new Error(`Global voice app runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Global voice app syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
for(const file of agentTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(agentBlock.test(source))source=source.replace(agentBlock,agentRuntime);else{
    const anchor='  /* Assurance Regent v6.3.98 — Jivan uses exact Zari sign-in voice END */';
    if(!source.includes(anchor))throw new Error(`Global Jivan voice v6.4.0 requires v6.3.98 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${agentRuntime}`);
  }
  for(const token of ['JIVAN_GLOBAL_VOICE_SCHEMA640','AssuranceRegentCanonicalVoice','agent:\'JIVAN\'','OPENAI_SERVER_TTS','voice:\'coral\'','sameAsZari:true'])if(!source.includes(token))throw new Error(`Global Jivan voice runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Global Jivan voice syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!agentTargets.some(existsSync))throw new Error('No Jivan runtime was found for global voice v6.4.0.');
console.log('[global-zari-jivan-voice-v640] canonical=coral speed=1 server-generated=true all-browsers=true browser-fallback=emergency-only');
await import('./verify-global-zari-jivan-voice-v6-4-0.mjs');
