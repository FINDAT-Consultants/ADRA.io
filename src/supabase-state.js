import { createServerSupabase, hasSupabaseConfig } from './supabase.js';

const TABLE='assurance_regent_state';

function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}

export async function readAppState(stateKey,fallback){
  if(!hasSupabaseConfig()) throw new Error('Supabase is required for Assurance Regent persistence. Configure SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) on the server.');
  const db=createServerSupabase();
  const {data,error}=await db.from(TABLE).select('state_value').eq('state_key',String(stateKey)).maybeSingle();
  if(error)throw error;
  if(data?.state_value===undefined||data?.state_value===null){if(fallback!==undefined&&fallback!==null)await writeAppState(stateKey,fallback);return clone(fallback);}
  return clone(data.state_value);
}

export async function writeAppState(stateKey,value){
  if(!hasSupabaseConfig()) throw new Error('Supabase is required for Assurance Regent persistence. Configure SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) on the server.');
  const row={state_key:String(stateKey),state_value:clone(value),updated_at:new Date().toISOString()};
  const {data,error}=await createServerSupabase().from(TABLE).upsert(row,{onConflict:'state_key'}).select('state_value').single();
  if(error)throw error;
  return clone(data?.state_value??value);
}
