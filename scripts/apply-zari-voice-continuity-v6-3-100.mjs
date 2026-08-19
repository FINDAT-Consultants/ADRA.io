import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const appRuntimeFile=resolve(root,'scripts/zari-voice-continuity-v6-3-100-app-runtime.inc.js');
const agentRuntimeFile=resolve(root,'scripts/zari-voice-continuity-v6-3-100-agent-runtime.inc.js');
if(!existsSync(appRuntimeFile)||!existsSync(agentRuntimeFile))throw new Error('Zari voice continuity v6.3.100 runtime files are missing.');
const appRuntime=readFileSync(appRuntimeFile,'utf8').trimEnd(),agentRuntime=readFileSync(agentRuntimeFile,'utf8').trimEnd();
const appBlock=/  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari primary voice lifecycle START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari primary voice lifecycle END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari voice for Jivan START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari voice for Jivan END \*\//u;
const appTargets=[resolve(root,'app.js')],agentTargets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentTargets.push(join(publicDir,name));
}
for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(appBlock.test(source))source=source.replace(appBlock,appRuntime);else{
    const anchor='  /* Assurance Regent v6.3.98 — exact Zari sign-in voice bridge END */';
    if(!source.includes(anchor))throw new Error(`Zari voice continuity v6.3.100 requires v6.3.98 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${appRuntime}`);
  }
  for(const token of ['ZARI_PRIMARY_VOICE_LIFECYCLE_SCHEMA100','speakAuthPromptBeforeContinuity100=speakAuthPrompt','assurance-regent-zari-primary-voice-state','changesVoice:false'])if(!source.includes(token))throw new Error(`Zari continuity app runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Zari continuity app syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
for(const file of agentTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(agentBlock.test(source))source=source.replace(agentBlock,agentRuntime);else{
    const anchor='  /* Assurance Regent v6.3.98 — Jivan uses exact Zari sign-in voice END */';
    if(!source.includes(anchor))throw new Error(`Zari/Jivan continuity v6.3.100 requires v6.3.98 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${agentRuntime}`);
  }
  for(const token of ['ZARI_VOICE_CONTINUITY_SCHEMA100','waitForZariPrimaryQuiet100','noAlternateFallback:true','zariOnly:true','scheduleSessionGreeting=function'])if(!source.includes(token))throw new Error(`Zari continuity agent runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Zari continuity agent syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
if(!agentTargets.some(existsSync))throw new Error('No Jivan runtime found for Zari voice continuity v6.3.100.');
console.log('[zari-voice-continuity-v6-3-100] Zari sign-in voice=unchanged Jivan alternate fallback=disabled handoff overlap=blocked');
await import('./verify-zari-voice-continuity-v6-3-100.mjs');
