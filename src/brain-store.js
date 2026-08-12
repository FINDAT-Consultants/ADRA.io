import { randomUUID } from 'node:crypto';
import { PersistentSession } from './persistent-session.js';
import { readAppState, writeAppState } from './supabase-state.js';
const now = () => new Date().toISOString();
const clean = v => String(v ?? '').trim();
const DEFAULT = { version: 1, threads: {} };

async function readStore(){const v=await readAppState('system-brain',DEFAULT);return { ...structuredClone(DEFAULT), ...v, threads: v?.threads && typeof v.threads==='object' ? v.threads : {} };}
async function writeStore(v){await writeAppState('system-brain',v);return v;}
function actorKey(actorId){return clean(actorId)||'LOCAL-ADMIN';}
function newSessionId(actorId){return `brain:${actorKey(actorId)}:${randomUUID()}`;}
function ensureThreadIn(store,actorId){
  const key=actorKey(actorId);
  if(!store.threads[key])store.threads[key]={actorId:key,sessionId:newSessionId(key),messages:[],lastSignalHash:'',lastSignalAt:'',lastAdviceAt:'',learning:{intentCounts:{},moduleCounts:{},recentPatterns:[]},createdAt:now(),updatedAt:now()};
  const t=store.threads[key];
  if(!t.sessionId)t.sessionId=newSessionId(key);
  if(!Array.isArray(t.messages))t.messages=[];
  if(!t.learning||typeof t.learning!=='object')t.learning={intentCounts:{},moduleCounts:{},recentPatterns:[]};
  if(!t.learning.intentCounts||typeof t.learning.intentCounts!=='object')t.learning.intentCounts={};
  if(!t.learning.moduleCounts||typeof t.learning.moduleCounts!=='object')t.learning.moduleCounts={};
  if(!Array.isArray(t.learning.recentPatterns))t.learning.recentPatterns=[];
  return t;
}

export async function getBrainThread(actorId,{limit=120}={}){
  const store=await readStore(),t=ensureThreadIn(store,actorId);await writeStore(store);
  return {...t,messages:t.messages.slice(-Math.max(1,Math.min(Number(limit)||120,300)))};
}

export async function appendBrainMessage(actorId,{role='assistant',sender='',content='',source='conversation',read=true,signalHash='',metadata={}}={}){
  const text=clean(content);if(!text)throw new Error('Brain message content is required.');
  const store=await readStore(),t=ensureThreadIn(store,actorId),row={id:`BRAIN-${randomUUID()}`,role:role==='user'?'user':'assistant',sender:clean(sender)||(role==='user'?'User':'Recovery Agent'),content:text,source:clean(source)||'conversation',read:Boolean(read),created_at:now(),signal_hash:clean(signalHash),metadata:metadata&&typeof metadata==='object'?metadata:{}};
  t.messages.push(row);t.messages=t.messages.slice(-400);t.updatedAt=now();if(row.source==='proactive'){t.lastAdviceAt=row.created_at;if(row.signal_hash)t.lastSignalHash=row.signal_hash;}
  await writeStore(store);return row;
}

export async function markBrainMessageRead(actorId,id){
  const store=await readStore(),t=ensureThreadIn(store,actorId),row=t.messages.find(x=>x.id===id);if(!row)throw new Error('AI Advisor message not found.');row.read=true;row.read_at=now();t.updatedAt=now();await writeStore(store);return row;
}

export async function getUnreadBrainMessages(actorId,{limit=100}={}){
  const t=await getBrainThread(actorId,{limit:400});return t.messages.filter(x=>x.role==='assistant'&&!x.read).slice(-Math.min(Number(limit)||100,200)).reverse();
}

export async function updateBrainSignalState(actorId,{signalHash='',signalAt=now()}={}){
  const store=await readStore(),t=ensureThreadIn(store,actorId);if(signalHash!==undefined)t.lastSignalHash=clean(signalHash);t.lastSignalAt=signalAt||now();t.updatedAt=now();await writeStore(store);return {...t,messages:undefined};
}


export async function reconcileBrainNotifications(actorId,activeSignalIds=[]){
  const active=new Set((activeSignalIds||[]).map(String)),store=await readStore(),t=ensureThreadIn(store,actorId);let changed=0;
  for(const row of t.messages){if(row.role!=='assistant'||row.read||row.source!=='proactive')continue;const ids=Array.isArray(row.metadata?.signalIds)?row.metadata.signalIds.map(String):[];if(ids.length&&ids.every(id=>!active.has(id))){row.read=true;row.read_at=now();row.resolution='UNDERLYING_SIGNAL_CLEARED';changed++;}}
  if(changed){t.updatedAt=now();await writeStore(store);}return {changed};
}

export async function clearBrainConversation(actorId,{startNew=true}={}){
  const store=await readStore(),t=ensureThreadIn(store,actorId),oldSession=t.sessionId;await new PersistentSession(oldSession).clearSession();t.messages=[];t.lastSignalHash='';t.lastSignalAt='';t.lastAdviceAt='';t.updatedAt=now();if(startNew)t.sessionId=newSessionId(actorId);await writeStore(store);return {cleared:true,actorId:actorKey(actorId),oldSessionId:oldSession,sessionId:t.sessionId};
}


export async function recordBrainLearning(actorId,{message='',executedActions=[]}={}){
  const store=await readStore(),t=ensureThreadIn(store,actorId),text=clean(message).toLowerCase();
  const intent=/\bapprove|reject|acknowledge\b/.test(text)?'review_action':/\badd|create|save|record|start\b/.test(text)?'create_action':/\bupdate|change|edit|move|complete|finish\b/.test(text)?'update_action':/\bshow|list|find|check|analy[sz]e|explain|why|what|how\b/.test(text)?'analysis_query':'conversation';
  t.learning.intentCounts[intent]=Number(t.learning.intentCounts[intent]||0)+1;
  const modules=[...new Set((executedActions||[]).flatMap(a=>[clean(a.view),clean(a.panel)]).filter(Boolean))];
  for(const m of modules)t.learning.moduleCounts[m]=Number(t.learning.moduleCounts[m]||0)+1;
  if((executedActions||[]).length){t.learning.recentPatterns.unshift({at:now(),intent,command:clean(message).slice(0,240),modules,actions:(executedActions||[]).map(a=>clean(a.label)).filter(Boolean).slice(0,8)});t.learning.recentPatterns=t.learning.recentPatterns.slice(0,30);}
  t.updatedAt=now();await writeStore(store);return t.learning;
}

export async function getBrainLearningProfile(actorId){
  const store=await readStore(),t=ensureThreadIn(store,actorId);await writeStore(store);
  return {intentCounts:{...t.learning.intentCounts},moduleCounts:{...t.learning.moduleCounts},recentPatterns:t.learning.recentPatterns.slice(0,12)};
}
export async function getBrainStatus(actorId){
  const t=await getBrainThread(actorId,{limit:400});return {actorId:t.actorId,sessionId:t.sessionId,messageCount:t.messages.length,unreadCount:t.messages.filter(x=>x.role==='assistant'&&!x.read).length,lastAdviceAt:t.lastAdviceAt||null,lastSignalAt:t.lastSignalAt||null};
}
