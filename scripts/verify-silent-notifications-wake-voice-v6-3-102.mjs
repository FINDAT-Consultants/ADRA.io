import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const files=targets.filter(existsSync);if(!files.length)throw new Error('No built Jivan runtime found for v6.3.102 verification.');
for(const file of files){
  const source=readFileSync(file,'utf8');
  for(const token of [
    "SILENT_NOTIFICATION_WAKE_SCHEMA102='6.3.102'",
    'VOICE_WAKE_WINDOW_MS102=90*1000',
    'backgroundAudioRoutedToAgent:false',
    'notificationsSpoken:false',
    'notificationBadgesRemain:true',
    'idleRequiresAddress:true',
    "(?:jivan|jeevan|zari)",
    "String(reason||'').toLowerCase()==='notifications'",
    "setStatus('Background audio ignored",
    "addressedWake:addressed"
  ])if(!source.includes(token))throw new Error(`v6.3.102 verifier missing ${token} in ${file}`);
  if(!source.includes("const runProactiveBeforeSilentNotifications102=runProactive"))throw new Error(`Notification speech override missing in ${file}`);
  if(!source.includes('reminderPendingNotifications101.clear()'))throw new Error(`Pending notification speech queue is not cleared in ${file}`);
  if(!source.includes("voiceWakeUntil102=Date.now()+VOICE_WAKE_WINDOW_MS102"))throw new Error(`Wake conversation window missing in ${file}`);
  if(!source.includes("if(!addressed&&!engaged)"))throw new Error(`Ambient transcript routing guard missing in ${file}`);
  if(source.includes("notificationsSpoken:true"))throw new Error(`Notifications must never be marked as spoken in ${file}`);
}
console.log('[verify-silent-notifications-wake-voice-v6-3-102] PASS');
