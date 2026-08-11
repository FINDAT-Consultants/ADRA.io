import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const FILE=path.join(__dirname,'..','data','agent-activity.json');
const DEFAULT={version:1,nextSeq:1,runs:{}};
const clean=v=>String(v??'').trim();
const now=()=>new Date().toISOString();

async function readStore(){
  try{const raw=JSON.parse(await fs.readFile(FILE,'utf8'));return {...structuredClone(DEFAULT),...raw,runs:raw?.runs&&typeof raw.runs==='object'?raw.runs:{},nextSeq:Number(raw?.nextSeq||1)};}
  catch{await fs.writeFile(FILE,JSON.stringify(DEFAULT,null,2));return structuredClone(DEFAULT);}
}
async function writeStore(store){await fs.writeFile(FILE,JSON.stringify(store,null,2));return store;}

export async function beginAgentActivityRun({runId='',actorId='',sessionId='',message=''}={}){
  const store=await readStore(),id=clean(runId)||`RUN-${randomUUID()}`;
  store.runs[id]={id,actorId:clean(actorId),sessionId:clean(sessionId),message:clean(message),status:'running',startedAt:now(),completedAt:null,events:[]};
  await writeStore(store);
  await pushAgentActivity({runId:id,actorId,phase:'start',view:'assistant',selector:'[data-view="assistant"]',label:'Understanding the command and planning the work',status:'working'});
  return id;
}

export async function pushAgentActivity({runId,actorId='',phase='work',view='',panel='',selector='',label='',status='working',metadata={}}={}){
  const id=clean(runId);if(!id)return null;
  const store=await readStore(),run=store.runs[id]||{id,actorId:clean(actorId),sessionId:'',message:'',status:'running',startedAt:now(),completedAt:null,events:[]};
  store.runs[id]=run;
  const event={id:`ACT-${randomUUID()}`,seq:store.nextSeq++,runId:id,actorId:clean(actorId)||run.actorId,phase:clean(phase)||'work',view:clean(view),panel:clean(panel),selector:clean(selector),label:clean(label)||'Working',status:clean(status)||'working',createdAt:now(),metadata:metadata&&typeof metadata==='object'?metadata:{}};
  run.events.push(event);run.events=run.events.slice(-300);
  await writeStore(store);return event;
}

export async function completeAgentActivityRun(runId,{status='completed',label='Task complete'}={}){
  const id=clean(runId);if(!id)return null;
  const store=await readStore(),run=store.runs[id];if(!run)return null;
  run.status=clean(status)||'completed';run.completedAt=now();
  const event={id:`ACT-${randomUUID()}`,seq:store.nextSeq++,runId:id,actorId:run.actorId,phase:'complete',view:'assistant',panel:'',selector:'[data-view="assistant"]',label:clean(label)||'Task complete',status:run.status,createdAt:now(),metadata:{}};
  run.events.push(event);await writeStore(store);return run;
}

export async function listAgentActivity({runId,after=0,limit=100}={}){
  const store=await readStore(),run=store.runs[clean(runId)];if(!run)return {run:null,events:[]};
  const n=Math.max(0,Number(after)||0),cap=Math.max(1,Math.min(Number(limit)||100,300));
  return {run:{id:run.id,actorId:run.actorId,status:run.status,startedAt:run.startedAt,completedAt:run.completedAt},events:(run.events||[]).filter(e=>Number(e.seq)>n).slice(0,cap)};
}

export async function clearOldAgentActivity({keep=40}={}){
  const store=await readStore(),runs=Object.values(store.runs).sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
  const allowed=new Set(runs.slice(0,Math.max(10,Number(keep)||40)).map(r=>r.id));for(const id of Object.keys(store.runs))if(!allowed.has(id))delete store.runs[id];
  await writeStore(store);return {runs:Object.keys(store.runs).length};
}
