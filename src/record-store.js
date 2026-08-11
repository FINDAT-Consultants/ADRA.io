import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServerSupabase, hasSupabaseConfig } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORD_FILE = path.join(__dirname, '..', 'data', 'system-records.json');
const ACTION_FILE = path.join(__dirname, '..', 'data', 'agent-actions.json');

async function readJson(file, fallback = []) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function writeJson(file, value) { await fs.writeFile(file, JSON.stringify(value, null, 2)); }
function tokens(text) { return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []); }
function score(query, text) { const a=tokens(query),b=tokens(text); if(!a.size||!b.size)return 0; let n=0; for(const x of a)if(b.has(x))n++; return n/Math.sqrt(a.size*b.size); }

export async function listRecords({ limit = 100, recordType, status } = {}) {
  if (hasSupabaseConfig()) {
    const db=createServerSupabase();
    let q=db.from('system_records').select('*').order('updated_at',{ascending:false}).limit(limit);
    if(recordType)q=q.eq('record_type',recordType); if(status)q=q.eq('status',status);
    const {data,error}=await q; if(error)throw error; return data||[];
  }
  let rows=await readJson(RECORD_FILE,[]); if(recordType)rows=rows.filter(x=>x.record_type===recordType); if(status)rows=rows.filter(x=>x.status===status);
  return rows.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,limit);
}

export async function searchRecords(query,{limit=8}={}){
  const rows=await listRecords({limit:1000});
  return rows.map(r=>({...r,relevance:score(query,`${r.title||''} ${r.content||''} ${JSON.stringify(r.metadata||{})}`)})).filter(r=>r.relevance>0).sort((a,b)=>b.relevance-a.relevance).slice(0,limit);
}

export async function saveRecord({recordType='note',title,content,status='active',metadata={},source='agent',sessionId=''}){
  const now=new Date().toISOString(); const row={record_type:String(recordType),title:String(title||'').trim(),content:String(content||'').trim(),status:String(status||'active'),metadata:metadata&&typeof metadata==='object'?metadata:{},source:String(source||'agent'),session_id:String(sessionId||''),updated_at:now};
  if(!row.title||!row.content)throw new Error('Record title and content are required.');
  if(hasSupabaseConfig()){const db=createServerSupabase();const {data,error}=await db.from('system_records').insert({...row,created_at:now}).select('*').single();if(error)throw error;return data;}
  const rows=await readJson(RECORD_FILE,[]);const saved={id:randomUUID(),...row,created_at:now};rows.unshift(saved);await writeJson(RECORD_FILE,rows);return saved;
}

export async function updateRecordStatus(id,status){
  const now=new Date().toISOString();
  if(hasSupabaseConfig()){const db=createServerSupabase();const {data,error}=await db.from('system_records').update({status,updated_at:now}).eq('id',id).select('*').single();if(error)throw error;return data;}
  const rows=await readJson(RECORD_FILE,[]);const row=rows.find(x=>String(x.id)===String(id));if(!row)throw new Error('Record not found.');row.status=String(status);row.updated_at=now;await writeJson(RECORD_FILE,rows);return row;
}

export async function logAction({sessionId='',actionName,inputData={},resultData={},status='completed'}){
  const now=new Date().toISOString(); const row={session_id:String(sessionId),action_name:String(actionName),input_data:inputData,result_data:resultData,status,created_at:now};
  if(hasSupabaseConfig()){const db=createServerSupabase();const {data,error}=await db.from('agent_action_log').insert(row).select('*').single();if(error)throw error;return data;}
  const rows=await readJson(ACTION_FILE,[]);const saved={id:randomUUID(),...row};rows.unshift(saved);await writeJson(ACTION_FILE,rows.slice(0,2000));return saved;
}

export async function listActions(limit=100){
  if(hasSupabaseConfig()){const db=createServerSupabase();const {data,error}=await db.from('agent_action_log').select('*').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[];}
  return (await readJson(ACTION_FILE,[])).slice(0,limit);
}
