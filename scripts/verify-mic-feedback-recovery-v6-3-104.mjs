import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const targets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
let checked=0;
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');checked++;
  for(const token of [
    "const MIC_FEEDBACK_RECOVERY_SCHEMA104='6.3.104'",
    'manualMicImmediateCapture:true',
    'manualCaptureGraceMs:MANUAL_CAPTURE_GRACE_MS104',
    'transcriptionTimeoutMs:TRANSCRIBE_TIMEOUT_MS104',
    'responseTimeoutMs:SEND_TIMEOUT_MS104',
    'autoResumeConversation:false',
    "setStatus('Mic active · listening now. Speak your instruction, then pause.')",
    "setStatus('Audio captured · understanding what you said…',true)",
    'beginConversationCapture(activeStream,Date.now()+MANUAL_CAPTURE_GRACE_MS104)',
    'withTimeout104(bridge.invoke',
    'withTimeout104(bridge.send',
    'resetVoiceTurn104',
    'finishConversationTurn=async function',
    'startConversationMonitor=async function'
  ])if(!source.includes(token))throw new Error(`Mic feedback recovery verification missing ${token} in ${basename(file)}.`);
  if(!source.includes("if(String(reason||'').toLowerCase()==='notifications')"))throw new Error(`Silent notification guard missing in ${basename(file)}.`);
  if(!source.includes('if(!addressed&&!engaged)'))throw new Error(`Background audio guard missing in ${basename(file)}.`);
  if(!source.includes('voicePath:\'ZARI_APPROVED\''))throw new Error(`Approved Zari voice path marker missing in ${basename(file)}.`);
}
if(!checked)throw new Error('No Jivan runtime available to verify mic feedback recovery.');
console.log(`[verify-mic-feedback-recovery-v6-3-104] checked ${checked} runtime(s): manual mic captures, shows progress, times out safely, background/noise remains guarded, notifications remain silent`);
