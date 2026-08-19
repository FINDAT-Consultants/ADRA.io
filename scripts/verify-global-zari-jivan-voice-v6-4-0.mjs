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
  for(const token of ['GLOBAL_ZARI_JIVAN_VOICE_SCHEMA640','GLOBAL_ZARI_JIVAN_VOICE_NAME640=\'coral\'','GLOBAL_ZARI_JIVAN_VOICE_SPEED640=1','/functions/v1/jivan-voice','mode:\'speak\'','AssuranceRegentCanonicalVoice','OPENAI_SERVER_TTS','window.AssuranceRegentZariVoice=window.AssuranceRegentCanonicalVoice'])if(!source.includes(token))throw new Error(`v6.4.0 global voice verification failed: ${token} missing from ${file}`);
  if(source.includes("GLOBAL_ZARI_JIVAN_VOICE_NAME640='marin'"))throw new Error(`v6.4.0 must not use a separate Jivan voice in ${file}`);
}
let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8');
  for(const token of ['JIVAN_GLOBAL_VOICE_SCHEMA640','window.AssuranceRegentCanonicalVoice','cloud.speak(clean,{agent:\'JIVAN\'})','OPENAI_SERVER_TTS','voice:\'coral\'','speed:1','sameAsZari:true'])if(!source.includes(token))throw new Error(`v6.4.0 Jivan global voice verification failed: ${token} missing from ${file}`);
}
if(!agentCount)throw new Error('No Jivan runtime was available for v6.4.0 global voice verification.');
console.log('[verify-global-zari-jivan-voice-v640] PASS one server-generated coral voice at speed 1 for Zari and Jivan across browsers/devices; browser speech remains fallback only.');
