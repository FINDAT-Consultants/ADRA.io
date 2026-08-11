import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerSupabase, hasSupabaseConfig } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'conversation-sessions.json');

async function readLocal(){try{return JSON.parse(await fs.readFile(FILE,'utf8'));}catch{return {};}}
async function writeLocal(v){await fs.writeFile(FILE,JSON.stringify(v,null,2));}
const clone=(v)=>structuredClone(v);

export class PersistentSession {
  constructor(sessionId='default'){this.sessionId=String(sessionId||'default');}
  async getSessionId(){return this.sessionId;}
  async getItems(limit){
    let items;
    if(hasSupabaseConfig()){
      const db=createServerSupabase(); let q=db.from('agent_session_items').select('item,sequence').eq('session_id',this.sessionId).order('sequence',{ascending:true});
      const {data,error}=await q; if(error)throw error; items=(data||[]).map(x=>x.item);
    }else{const all=await readLocal();items=all[this.sessionId]||[];}
    if(limit===undefined)return items.map(clone); if(limit<=0)return []; return items.slice(-limit).map(clone);
  }
  async addItems(items){
    if(!items?.length)return;
    if(hasSupabaseConfig()){
      const db=createServerSupabase(); const {data:last,error:e1}=await db.from('agent_session_items').select('sequence').eq('session_id',this.sessionId).order('sequence',{ascending:false}).limit(1); if(e1)throw e1;
      let seq=Number(last?.[0]?.sequence||0); const rows=items.map(item=>({session_id:this.sessionId,sequence:++seq,item:clone(item)})); const {error}=await db.from('agent_session_items').insert(rows); if(error)throw error; return;
    }
    const all=await readLocal(); const current=all[this.sessionId]||[]; all[this.sessionId]=[...current,...items.map(clone)].slice(-400); await writeLocal(all);
  }
  async popItem(){
    if(hasSupabaseConfig()){
      const db=createServerSupabase();const {data,error}=await db.from('agent_session_items').select('id,item,sequence').eq('session_id',this.sessionId).order('sequence',{ascending:false}).limit(1);if(error)throw error;const row=data?.[0];if(!row)return undefined;const {error:del}=await db.from('agent_session_items').delete().eq('id',row.id);if(del)throw del;return clone(row.item);
    }
    const all=await readLocal(); const items=all[this.sessionId]||[]; const item=items.pop(); all[this.sessionId]=items; await writeLocal(all); return item?clone(item):undefined;
  }
  async clearSession(){
    if(hasSupabaseConfig()){const db=createServerSupabase();const {error}=await db.from('agent_session_items').delete().eq('session_id',this.sessionId);if(error)throw error;return;}
    const all=await readLocal(); all[this.sessionId]=[]; await writeLocal(all);
  }
}
