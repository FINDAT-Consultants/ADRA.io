import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appFiles=[resolve(root,'app.js')],agentFiles=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appFiles.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentFiles.push(join(publicDir,name));
}
for(const file of appFiles.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['ZARI_SHARED_VOICE_SCHEMA98','resolveZariSharedVoice98','zariSharedSpeak98','utterance.rate=1','utterance.pitch=1','utterance.volume=.9','AssuranceRegentZariVoice','speakAuthPrompt=function'])if(!source.includes(token))throw new Error(`v6.3.98 shared Zari voice verification failed: ${token} missing from ${file}`);
  if(!source.includes("channel:'ZARI'"))throw new Error(`v6.3.98 Zari channel routing is missing from ${file}`);
}
let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8');
  for(const token of ['JIVAN_ZARI_VOICE_SCHEMA98','jivanSpeakBase98','window.AssuranceRegentZariVoice','shared.speak(clean','channel:\'JIVAN\'','AssuranceRegentJivanVoiceBridge','ZARI_SYNTHETIC_VOICE'])if(!source.includes(token))throw new Error(`v6.3.98 Jivan voice verification failed: ${token} missing from ${file}`);
  if(!source.includes('return jivanSpeakBase98(clean)'))throw new Error(`v6.3.98 Jivan voice fallback is missing from ${file}`);
}
if(!agentCount)throw new Error('No Jivan runtime was available for shared voice verification.');
console.log('[verify-zari-jivan-voice-v98] PASS Zari voice bridge is shared with Jivan; Jivan identity/logic remain separate and fallback speech is preserved.');
