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
  for(const token of ['ZARI_SHARED_VOICE_SCHEMA98','zariSignInSpeakBase98=speakAuthPrompt','zariSharedSpeak98','EXACT_SIGNIN_HANDOFF','AssuranceRegentZariVoice','explicitVoiceSelection:false'])if(!source.includes(token))throw new Error(`v6.3.98 exact Zari sign-in voice verification failed: ${token} missing from ${file}`);
  if(source.includes('resolveZariSharedVoice98'))throw new Error(`v6.3.98 must not select a separate synthetic voice in ${file}`);
  if(source.includes('utterance.voice='))throw new Error(`v6.3.98 must not override Zari's browser-selected sign-in voice in ${file}`);
}
let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8');
  for(const token of ['JIVAN_ZARI_VOICE_SCHEMA98','jivanSpeakBase98','window.AssuranceRegentZariVoice','shared.speak(clean','channel:\'JIVAN\'','AssuranceRegentJivanVoiceBridge','EXACT_ZARI_SIGNIN_HANDOFF_VOICE'])if(!source.includes(token))throw new Error(`v6.3.98 Jivan exact Zari voice verification failed: ${token} missing from ${file}`);
  if(!source.includes('return jivanSpeakBase98(clean)'))throw new Error(`v6.3.98 Jivan voice fallback is missing from ${file}`);
}
if(!agentCount)throw new Error('No Jivan runtime was available for exact Zari sign-in voice verification.');
console.log('[verify-zari-jivan-voice-v98] PASS Jivan calls the exact Zari sign-in/handoff speech function; no separate voice selector or tuning is introduced.');
