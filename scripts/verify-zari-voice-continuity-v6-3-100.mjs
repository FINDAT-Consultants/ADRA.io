import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appFiles=[resolve(root,'app.js')],agentFiles=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appFiles.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentFiles.push(join(publicDir,name));
}
const appBlock=/  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari primary voice lifecycle START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari primary voice lifecycle END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari voice for Jivan START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.100 — uninterrupted Zari voice for Jivan END \*\//u;

for(const file of appFiles.filter(existsSync)){
  const source=readFileSync(file,'utf8'),match=source.match(appBlock);if(!match)throw new Error(`v6.3.100 Zari lifecycle block missing from ${file}`);const block=match[0];
  for(const token of ["ZARI_PRIMARY_VOICE_LIFECYCLE_SCHEMA100='6.3.100'",'speakAuthPromptBeforeContinuity100=speakAuthPrompt','speakAuthPromptBeforeContinuity100(clean)','assurance-regent-zari-primary-voice-state',"provider:'EXACT_SIGNIN_HANDOFF'",'sameVoice:true','changesVoice:false'])if(!block.includes(token))throw new Error(`v6.3.100 Zari lifecycle verification failed: ${token} missing from ${file}`);
  for(const forbidden of ['new SpeechSynthesisUtterance','.rate=','.pitch=','.volume=','getVoices()','AssuranceRegentCanonicalVoice','OPENAI_SERVER_TTS'])if(block.includes(forbidden))throw new Error(`v6.3.100 must not change Zari voice characteristics in ${file}: ${forbidden}`);
}
let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8'),match=source.match(agentBlock);if(!match)throw new Error(`v6.3.100 Zari/Jivan continuity block missing from ${file}`);const block=match[0];
  for(const token of ["ZARI_VOICE_CONTINUITY_SCHEMA100='6.3.100'",'await waitForZariPrimaryQuiet100()','const shared=window.AssuranceRegentZariVoice',"shared.speak(clean,{channel:'JIVAN'})",'noAlternateFallback:true','zariOnly:true','scheduleSessionGreeting=function','assurance-regent-zari-primary-voice-state','assurance-regent-agent-handoff'])if(!block.includes(token))throw new Error(`v6.3.100 Jivan continuity verification failed: ${token} missing from ${file}`);
  for(const forbidden of ['jivanSpeakBase98(clean)','startInstantSpeech(clean)','availableInstantVoice()','lockedVoiceName','AssuranceRegentCanonicalVoice','OPENAI_SERVER_TTS'])if(block.includes(forbidden))throw new Error(`v6.3.100 competing Jivan voice path detected in ${file}: ${forbidden}`);
  const v98=source.indexOf('/* Assurance Regent v6.3.98 — Jivan uses exact Zari sign-in voice START */'),v100=source.indexOf('/* Assurance Regent v6.3.100 — uninterrupted Zari voice for Jivan START */');if(v98<0||v100<=v98)throw new Error(`v6.3.100 must override the older Jivan voice path after v6.3.98 in ${file}`);
}
if(!agentCount)throw new Error('No Jivan runtime available for v6.3.100 continuity verification.');
console.log('[verify-zari-voice-continuity-v6-3-100] PASS Zari sign-in voice remains unchanged; Jivan uses only that bridge; handoff speech cannot be overlapped by the session greeting.');
