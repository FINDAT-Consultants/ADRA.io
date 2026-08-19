import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appFiles=[resolve(root,'app.js')],agentFiles=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appFiles.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentFiles.push(join(publicDir,name));
}

const forbidden=[
  'GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640',
  'AssuranceRegentCanonicalVoice',
  'OPENAI_SERVER_TTS',
  'zari-public-voice',
  "provider:'OPENAI_SERVER_TTS'"
];

for(const file of appFiles.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of [
    "ZARI_SHARED_VOICE_SCHEMA98='6.3.98-exact-signin'",
    'zariSignInSpeakBase98=speakAuthPrompt',
    'zariSignInSpeakBase98(clean)',
    "provider:'EXACT_SIGNIN_HANDOFF'",
    "mode:'browser-default-via-zari-signin'",
    'explicitVoiceSelection:false'
  ])if(!source.includes(token))throw new Error(`Approved Zari sign-in voice contract changed: ${token} missing from ${file}`);
  for(const token of forbidden)if(source.includes(token))throw new Error(`Disallowed replacement voice path detected in ${file}: ${token}`);
}

let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8');
  for(const token of [
    "JIVAN_ZARI_VOICE_SCHEMA98='6.3.98-exact-signin'",
    'const shared=window.AssuranceRegentZariVoice',
    "shared.speak(clean,{channel:'JIVAN'})",
    "provider:'EXACT_ZARI_SIGNIN_HANDOFF_VOICE'",
    'shared:true'
  ])if(!source.includes(token))throw new Error(`Approved Jivan/Zari shared voice contract changed: ${token} missing from ${file}`);
  for(const token of forbidden)if(source.includes(token))throw new Error(`Disallowed replacement voice path detected in ${file}: ${token}`);
}
if(!agentCount)throw new Error('No Jivan runtime found for voice contract verification.');

console.log('[verify-zari-jivan-voice-contract-v6-3-99] PASS approved Zari sign-in/handoff voice path is locked; no canonical/cloud replacement is present.');
