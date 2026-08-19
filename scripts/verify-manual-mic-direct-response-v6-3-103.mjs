import {existsSync,readFileSync,readdirSync,resolve,join} from 'node:fs';
import {basename} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
let checked=0;
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');checked++;
  for(const token of [
    "const MANUAL_MIC_RESPONSE_SCHEMA103='6.3.103'",
    'startVoiceConversationBeforeManualMic103=startVoiceConversation',
    'const automatic=Boolean(opts.automatic)',
    'if(started&&!automatic)',
    'voiceWake102();',
    'manualMicStartsEngaged:true',
    'manualMicRequiresWakeName:false',
    'automaticBackgroundRequiresAddress:true',
    'backgroundAudioRoutedToAgent:false',
    'notificationsSpoken:false'
  ])if(!source.includes(token))throw new Error(`Manual microphone response verification missing ${token} in ${basename(file)}.`);
  if(!source.includes("if(String(reason||'').toLowerCase()==='notifications')"))throw new Error(`Silent notification guard missing in ${basename(file)}.`);
  if(!source.includes('if(!addressed&&!engaged)'))throw new Error(`Background audio transcript guard missing in ${basename(file)}.`);
}
if(!checked)throw new Error('No Jivan runtime available to verify manual microphone behavior.');
console.log(`[verify-manual-mic-direct-response-v6-3-103] checked ${checked} runtime(s): manual mic responds directly; background/noise guard and silent notifications retained`);
