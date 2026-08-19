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
  for(const token of ['QUIET_ASSISTANT_SCHEMA97','QUIET_NOTIFICATION_INTERVAL_MS97=30*60*1000','quietNotificationPending97','quietScheduleNotifications97','assurance-regent-notifications-digest','lastAgentNotificationCount=u?n:-1','Access is confirmed. Jivan is available when you request a task.'])if(!source.includes(token))throw new Error(`v6.3.97 app verification failed: ${token} missing from ${file}`);
}
let agentCount=0;
for(const file of agentFiles.filter(existsSync)){
  agentCount++;const source=readFileSync(file,'utf8');
  for(const token of ['QUIET_AGENT_SCHEMA97','quietTaskRequest97','quietVoiceInvocation97','quietPermitSpeech97','runProactive=async function(){return null;}','scheduleSessionGreeting=function(){return null;}','checkEndOfDay=function(){return null;}','resumeConversation:false','autoStartGranted:false','explicit_invocation_required','Ambient conversation ignored. Say “Jivan” or “Zari” and ask for a task when you want help.'])if(!source.includes(token))throw new Error(`v6.3.97 agent verification failed: ${token} missing from ${file}`);
  if(!source.includes("source==='voice-conversation'"))throw new Error(`v6.3.97 voice-source guard missing from ${file}`);
  if(!source.includes("const wake=/^(?:(?:hey|hello|hi|ok|okay|please)\\s+)?(?:jivan|zari)\\b/i"))throw new Error(`v6.3.97 direct-name wake guard missing from ${file}`);
}
if(!agentCount)throw new Error('No Jivan agent runtime was available for v6.3.97 verification.');
console.log('[verify-quiet-assistant-v97] PASS 30-minute notification digest, proactive speech disabled, automatic voice resume disabled, ambient conversations require Jivan/Zari + task request.');
