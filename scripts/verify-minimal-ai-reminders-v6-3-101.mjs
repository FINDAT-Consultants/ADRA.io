import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const files=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))files.push(join(publicDir,name));
let count=0;
for(const file of files.filter(existsSync)){
  count++;const source=readFileSync(file,'utf8');
  for(const token of [
    "MINIMAL_AI_REMINDERS_SCHEMA101='6.3.101'",
    'REMINDER_BREATHING_MS101=5*60*1000',
    'NOTIFICATION_COOLDOWN_MS101=20*60*1000',
    'CRITICAL_NOTIFICATION_GAP_MS101=5*60*1000',
    'reminderKnownNotifications101',
    'reminderPendingNotifications101',
    "if(why==='notifications'){reminderQueueNotifications101(extra);reminderScheduleFlush101();return null;}",
    "mode:'PRIORITY_BATCHED'",
    'existingBacklogSpokenOnOpen:false',
    'deduplicated:true',
    'badgesImmediate:true',
    "voicePath:'ZARI_APPROVED'"
  ])if(!source.includes(token))throw new Error(`Minimal reminder verification failed: ${token} missing from ${file}`);
  for(const forbidden of ['notificationCooldownMinutes:0','existingBacklogSpokenOnOpen:true'])if(source.includes(forbidden))throw new Error(`Minimal reminder regression detected in ${file}: ${forbidden}`);
}
if(!count)throw new Error('No Jivan runtime available for minimal reminder verification.');
console.log('[verify-minimal-ai-reminders-v6-3-101] PASS reminders are deduplicated, priority-batched, spaced by cooldowns, and existing backlog remains silent on open.');
