import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function supabaseRequired() {
  const explicit=String(process.env.SUPABASE_REQUIRED||'').trim().toLowerCase();
  if(explicit)return !['0','false','no','off'].includes(explicit);
  return process.env.NODE_ENV==='production';
}

export function requireSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase server credentials are required. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).');
  }
}

export function createServerSupabase() {
  requireSupabaseConfig();
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function assertSupabaseReady() {
  if(!hasSupabaseConfig()){
    if(supabaseRequired())requireSupabaseConfig();
    return {configured:false,required:false};
  }
  const db=createServerSupabase();
  const {error}=await db.from('app_state_documents').select('state_key',{head:true,count:'exact'}).limit(1);
  if(error)throw new Error(`Supabase schema is not ready: ${error.message}. Run supabase/ASSURANCE_REGENT_SUPABASE_SETUP.sql first.`);
  return {configured:true,required:supabaseRequired()};
}

export async function readAppState(stateKey,fallback,{seedIfMissing=true}={}) {
  if(!hasSupabaseConfig()){
    if(supabaseRequired())requireSupabaseConfig();
    return structuredClone(fallback);
  }
  const db=createServerSupabase();
  const {data,error}=await db.from('app_state_documents').select('state_value').eq('state_key',String(stateKey)).maybeSingle();
  if(error)throw error;
  if(data?.state_value!==undefined&&data?.state_value!==null)return structuredClone(data.state_value);
  if(seedIfMissing){
    const value=structuredClone(fallback);
    const {error:seedError}=await db.from('app_state_documents').upsert({state_key:String(stateKey),state_value:value,updated_at:new Date().toISOString()},{onConflict:'state_key'});
    if(seedError)throw seedError;
    return value;
  }
  return structuredClone(fallback);
}

export async function writeAppState(stateKey,stateValue) {
  if(!hasSupabaseConfig()){
    if(supabaseRequired())requireSupabaseConfig();
    return stateValue;
  }
  const db=createServerSupabase();
  const {error}=await db.from('app_state_documents').upsert({state_key:String(stateKey),state_value:stateValue,updated_at:new Date().toISOString()},{onConflict:'state_key'});
  if(error)throw error;
  return stateValue;
}

export async function loadServerSecret(secretName) {
  if(!hasSupabaseConfig())return '';
  const db=createServerSupabase();
  const {data,error}=await db.rpc('get_server_secret',{secret_name:String(secretName)});
  if(error)throw new Error(`Unable to read Supabase Vault secret ${secretName}: ${error.message}`);
  return String(data||'').trim();
}

export async function bootstrapOpenAIFromSupabaseVault() {
  if(String(process.env.OPENAI_API_KEY||'').trim())return {configured:true,source:'deployment-environment'};
  if(!hasSupabaseConfig())return {configured:false,source:'none'};
  const key=await loadServerSecret('OPENAI_API_KEY');
  if(key){process.env.OPENAI_API_KEY=key;return {configured:true,source:'supabase-vault'};}
  return {configured:false,source:'supabase-vault-missing'};
}

export async function uploadStorageObject(bucket,path,bytes,{contentType='application/octet-stream',upsert=true}={}) {
  const db=createServerSupabase();
  const {data,error}=await db.storage.from(String(bucket)).upload(String(path),bytes,{contentType,upsert,cacheControl:'3600'});
  if(error)throw error;
  return data;
}
