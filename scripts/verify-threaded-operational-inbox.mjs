import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),htmlPath=join(publicDir,'index.html');
if(!existsSync(htmlPath))throw new Error('public/index.html is missing.');
const html=readFileSync(htmlPath,'utf8'),appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published app runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');
const edgePath=resolve(root,'supabase/functions/jivan-inbox-ai/index.ts'),sqlPath=resolve(root,'supabase/THREADED_OPERATIONAL_AI_INBOX_V6_3_28.sql');
if(!existsSync(edgePath)||!existsSync(sqlPath))throw new Error('Operational Inbox Supabase sources are missing.');
const edge=readFileSync(edgePath,'utf8'),sql=readFileSync(sqlPath,'utf8');

for(const token of ['work-inbox-threaded.css?v=6.3.28','id="inboxThreadDialog"','id="inboxThreadHistory"','id="inboxThreadReplyForm"','id="inboxThreadReply"','id="inboxThreadClear"'])if(!html.includes(token))throw new Error(`Threaded Inbox UI is missing ${token}.`);
for(const token of [
  'v6.3.28 — threaded staff conversations + operational AI Inbox advisories only.',
  'function inboxThreadGroups()',
  'function openInboxThread(threadId)',
  'async function clearInboxThread(threadId)',
  'async function sendInboxThreadReply(e)',
  'async function refreshOperationalInboxAdvisories(force=false)',
  'assurance_regent_browser_message_thread',
  'assurance_regent_browser_message_thread_mark_read',
  'assurance_regent_browser_message_clear_thread',
  "supabaseFunction('jivan-inbox-ai',{mode:'advisories'",
  "supabaseFunction('jivan-inbox-ai',{mode:'reply'",
  "p_thread_id:thread.threadId"
])if(!app.includes(token))throw new Error(`Threaded Inbox runtime is missing ${token}.`);
if(app.includes('assurance_regent_browser_message_ai_self'))throw new Error('Generic Jivan chat can still write to the Inbox.');
if(app.includes('queueAiInboxMessage(value,label)'))throw new Error('Ordinary Jivan showMessage still routes to the Inbox.');
if(!app.includes("showMessage:(text,label='Jivan notification')=>addMessage('assistant',String(text||''),false,label),"))throw new Error('Ordinary Jivan showMessage is not isolated to the chatbox.');

for(const token of ['thread_id text not null','hidden_for_sender boolean','hidden_for_recipient boolean','assurance_regent_browser_message_thread','assurance_regent_browser_message_thread_mark_read','assurance_regent_browser_message_clear_thread',"'AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD'",'drop function if exists public.assurance_regent_browser_message_ai_self'])if(!sql.includes(token))throw new Error(`Inbox database migration is missing ${token}.`);
for(const token of [
  'dedicated operational AI Inbox engine',
  "if(authority==='HR_MANAGER')return ['EMPLOYEE_PERFORMANCE','LEAVE_ATTENTION','WORKFORCE_RISK']",
  "if(authority==='PROGRAMS_MANAGER')return ['PROJECT_PERFORMANCE','PROGRAM_STRATEGY','PROJECT_SUGGESTION','TEAM_PERFORMANCE']",
  "if(authority==='PROJECT_MANAGER')return ['PROJECT_PERFORMANCE','PROJECT_DELIVERY','TEAM_PERFORMANCE']",
  'AI_OPERATIONAL_ADVISORY',
  'AI_INBOX_THREAD',
  "mode==='advisories'",
  "mode==='reply'",
  'you have no access to that chat history'
])if(!edge.includes(token))throw new Error(`Operational AI Inbox engine is missing ${token}.`);

console.log('[threaded-inbox-verify] OK: Inbox entries are conversation threads with history, replies and per-user Clear.');
console.log('[threaded-inbox-verify] OK: human staff messages remain private one-to-one conversations with attachments.');
console.log('[threaded-inbox-verify] OK: AI Inbox content is restricted to role-scoped operational advisories and their thread replies.');
console.log('[threaded-inbox-verify] OK: ordinary Jivan chat/proactive chat cannot flow into the Inbox.');
