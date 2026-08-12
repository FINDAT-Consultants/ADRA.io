import { createHash, randomBytes } from 'node:crypto';
import { createServerSupabase } from './supabase.js';

const SESSION_TABLE='assurance_regent_auth_sessions';
export const AUTH_SESSION_TTL_MS=Math.max(60_000,Number(process.env.AUTH_SESSION_TTL_MS||12*60*60*1000));

const hashToken=(token)=>createHash('sha256').update(String(token||'')).digest('hex');
const expiresIso=()=>new Date(Date.now()+AUTH_SESSION_TTL_MS).toISOString();

export async function issueAuthSession(userId){
  const token=randomBytes(32).toString('base64url');
  const row={token_hash:hashToken(token),user_id:String(userId),expires_at:expiresIso(),updated_at:new Date().toISOString()};
  const db=createServerSupabase();
  const {error}=await db.from(SESSION_TABLE).insert(row);
  if(error)throw error;
  // Opportunistic cleanup; failure must not block the newly created session.
  db.from(SESSION_TABLE).delete().lt('expires_at',new Date().toISOString()).then(()=>{}).catch(()=>{});
  return token;
}

export async function getAuthSession(token,{refresh=false}={}){
  if(!token)return null;
  const db=createServerSupabase(),tokenHash=hashToken(token);
  const {data,error}=await db.from(SESSION_TABLE).select('user_id,expires_at').eq('token_hash',tokenHash).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  if(new Date(data.expires_at).getTime()<=Date.now()){
    await db.from(SESSION_TABLE).delete().eq('token_hash',tokenHash);
    return null;
  }
  if(refresh){
    const nextExpiry=expiresIso();
    const {error:updateError}=await db.from(SESSION_TABLE).update({expires_at:nextExpiry,updated_at:new Date().toISOString()}).eq('token_hash',tokenHash);
    if(updateError)throw updateError;
    return {userId:String(data.user_id),expiresAt:nextExpiry};
  }
  return {userId:String(data.user_id),expiresAt:data.expires_at};
}

export async function revokeAuthSession(token){
  if(!token)return {revoked:false};
  const {error}=await createServerSupabase().from(SESSION_TABLE).delete().eq('token_hash',hashToken(token));
  if(error)throw error;
  return {revoked:true};
}
