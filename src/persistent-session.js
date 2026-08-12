import { createServerSupabase } from './supabase.js';

const clone=(v)=>structuredClone(v);

export class PersistentSession {
  constructor(sessionId='default'){this.sessionId=String(sessionId||'default');}
  async getSessionId(){return this.sessionId;}
  async getItems(limit){
    const db=createServerSupabase();
    const {data,error}=await db.from('agent_session_items').select('item,sequence').eq('session_id',this.sessionId).order('sequence',{ascending:true});
    if(error)throw error;
    const items=(data||[]).map(x=>x.item);
    if(limit===undefined)return items.map(clone); if(limit<=0)return []; return items.slice(-limit).map(clone);
  }
  async addItems(items){
    if(!items?.length)return;
    const db=createServerSupabase();
    const {data:last,error:e1}=await db.from('agent_session_items').select('sequence').eq('session_id',this.sessionId).order('sequence',{ascending:false}).limit(1);if(e1)throw e1;
    let seq=Number(last?.[0]?.sequence||0);const rows=items.map(item=>({session_id:this.sessionId,sequence:++seq,item:clone(item)}));const {error}=await db.from('agent_session_items').insert(rows);if(error)throw error;
  }
  async popItem(){
    const db=createServerSupabase();const {data,error}=await db.from('agent_session_items').select('id,item,sequence').eq('session_id',this.sessionId).order('sequence',{ascending:false}).limit(1);if(error)throw error;const row=data?.[0];if(!row)return undefined;const {error:del}=await db.from('agent_session_items').delete().eq('id',row.id);if(del)throw del;return clone(row.item);
  }
  async clearSession(){
    const db=createServerSupabase();const {error}=await db.from('agent_session_items').delete().eq('session_id',this.sessionId);if(error)throw error;
  }
}
