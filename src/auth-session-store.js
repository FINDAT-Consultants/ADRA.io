import { createHash, randomBytes } from 'node:crypto';
import { createServerSupabase, hasSupabaseConfig, supabaseRequired } from './supabase.js';

const fallbackSessions=new Map();
const tokenHash=token=>createHash('sha256').update(String(token||'')).digest('hex');

export async function issueAuthSession(userId,ttlMs){
  const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+Number(ttlMs)).toISOString();
  if(hasSupabaseConfig()){
    const {error}=await createServerSupabase().from('app_auth_sessions').insert({token_hash:tokenHash(token),user_id:String(userId),expires_at:expiresAt,updated_at:new Date().toISOString()});
    if(error)throw error;
  }else{
    if(supabaseRequired())throw new Error('Supabase is required for authentication sessions.');
    fallbackSessions.set(token,{userId:String(userId),expiresAt:new Date(expiresAt).getTime()});
  }
  return token;
}

export async function getAuthSession(token,ttlMs){
  const raw=String(token||'');if(!raw)return null;
  if(hasSupabaseConfig()){
    const db=createServerSupabase(),hash=tokenHash(raw);
    const {data,error}=await db.from('app_auth_sessions').select('user_id,expires_at').eq('token_hash',hash).maybeSingle();
    if(error)throw error;if(!data)return null;
    if(new Date(data.expires_at).getTime()<=Date.now()){await db.from('app_auth_sessions').delete().eq('token_hash',hash);return null;}
    const expiresAt=new Date(Date.now()+Number(ttlMs)).toISOString();
    const {error:touchError}=await db.from('app_auth_sessions').update({expires_at:expiresAt,updated_at:new Date().toISOString()}).eq('token_hash',hash);
    if(touchError)throw touchError;
    return {userId:String(data.user_id),expiresAt:new Date(expiresAt).getTime()};
  }
  const session=fallbackSessions.get(raw);if(!session)return null;
  if(session.expiresAt<=Date.now()){fallbackSessions.delete(raw);return null;}
  session.expiresAt=Date.now()+Number(ttlMs);return session;
}

export async function revokeAuthSession(token){
  const raw=String(token||'');if(!raw)return;
  if(hasSupabaseConfig()){
    const {error}=await createServerSupabase().from('app_auth_sessions').delete().eq('token_hash',tokenHash(raw));
    if(error)throw error;
  }else fallbackSessions.delete(raw);
}

export async function purgeExpiredAuthSessions(){
  if(!hasSupabaseConfig())return {deleted:0};
  const {error}=await createServerSupabase().from('app_auth_sessions').delete().lt('expires_at',new Date().toISOString());
  if(error)throw error;
  return {ok:true};
}
