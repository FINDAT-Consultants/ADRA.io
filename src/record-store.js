import { createServerSupabase } from './supabase.js';

function tokens(text) { return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []); }
function score(query, text) { const a=tokens(query),b=tokens(text); if(!a.size||!b.size)return 0; let n=0; for(const x of a)if(b.has(x))n++; return n/Math.sqrt(a.size*b.size); }

export async function listRecords({ limit = 100, recordType, status } = {}) {
  const db=createServerSupabase();
  let q=db.from('system_records').select('*').order('updated_at',{ascending:false}).limit(limit);
  if(recordType)q=q.eq('record_type',recordType); if(status)q=q.eq('status',status);
  const {data,error}=await q; if(error)throw error; return data||[];
}

export async function searchRecords(query,{limit=8}={}){
  const rows=await listRecords({limit:1000});
  return rows.map(r=>({...r,relevance:score(query,`${r.title||''} ${r.content||''} ${JSON.stringify(r.metadata||{})}`)})).filter(r=>r.relevance>0).sort((a,b)=>b.relevance-a.relevance).slice(0,limit);
}

export async function saveRecord({recordType='note',title,content,status='active',metadata={},source='agent',sessionId=''}){
  const now=new Date().toISOString(); const row={record_type:String(recordType),title:String(title||'').trim(),content:String(content||'').trim(),status:String(status||'active'),metadata:metadata&&typeof metadata==='object'?metadata:{},source:String(source||'agent'),session_id:String(sessionId||''),updated_at:now};
  if(!row.title||!row.content)throw new Error('Record title and content are required.');
  const db=createServerSupabase();const {data,error}=await db.from('system_records').insert({...row,created_at:now}).select('*').single();if(error)throw error;return data;
}

export async function updateRecordStatus(id,status){
  const now=new Date().toISOString();
  const db=createServerSupabase();const {data,error}=await db.from('system_records').update({status,updated_at:now}).eq('id',id).select('*').single();if(error)throw error;return data;
}

export async function logAction({sessionId='',actionName,inputData={},resultData={},status='completed'}){
  const now=new Date().toISOString(); const row={session_id:String(sessionId),action_name:String(actionName),input_data:inputData,result_data:resultData,status,created_at:now};
  const db=createServerSupabase();const {data,error}=await db.from('agent_action_log').insert(row).select('*').single();if(error)throw error;return data;
}

export async function listActions(limit=100){
  const db=createServerSupabase();const {data,error}=await db.from('agent_action_log').select('*').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[];
}
