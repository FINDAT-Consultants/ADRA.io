// Assurance Regent v6.3.78 — secure Gmail OAuth + Google Meet read access
// OAuth client credentials are read from Supabase Vault through a service-role-only RPC.
declare const Deno:any;

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
};
const GMAIL_SEND_SCOPE='https://www.googleapis.com/auth/gmail.send';
const MEET_READ_SCOPE='https://www.googleapis.com/auth/meetings.space.readonly';
const OPENID_SCOPES=`openid email ${GMAIL_SEND_SCOPE} ${MEET_READ_SCOPE}`;
const DEFAULT_RETURN_ORIGIN='https://ar-intel.netlify.app';

function json(body:any,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function env(name:string){return String(Deno.env.get(name)||'').trim();}
function baseUrl(){const v=env('SUPABASE_URL');if(!v)throw new Error('SUPABASE_URL is not configured.');return v.replace(/\/$/,'');}
function serviceKey(){const v=env('SUPABASE_SERVICE_ROLE_KEY');if(!v)throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');return v;}
function publishableKey(){const raw=env('SUPABASE_PUBLISHABLE_KEYS');if(raw){try{const x=JSON.parse(raw);if(x?.default)return String(x.default);const first=Object.values(x||{})[0];if(first)return String(first);}catch{}}return env('SUPABASE_PUBLISHABLE_KEY')||env('SUPABASE_ANON_KEY');}
function clean(v:any,max=12000){return String(v??'').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').slice(0,max);}
function isEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
function bytesBase64(bytes:Uint8Array){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
function base64UrlBytes(bytes:Uint8Array){return bytesBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function base64UrlText(value:string){return base64UrlBytes(new TextEncoder().encode(value));}
function encodedHeader(value:string){const v=String(value||'');return /[^\x20-\x7e]/.test(v)?`=?UTF-8?B?${bytesBase64(new TextEncoder().encode(v))}?=`:v.replace(/[\r\n]+/g,' ');}
async function sha256Hex(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function randomState(){const b=new Uint8Array(32);crypto.getRandomValues(b);return base64UrlBytes(b);}
function redirectUri(){return `${baseUrl()}/functions/v1/gmail-connector`;}
function allowedReturnOrigins(){return new Set([DEFAULT_RETURN_ORIGIN,...env('GMAIL_ALLOWED_RETURN_ORIGINS').split(',').map(x=>x.trim()).filter(Boolean)]);}
function safeReturnTo(value:any){try{const u=new URL(String(value||DEFAULT_RETURN_ORIGIN));if(!allowedReturnOrigins().has(u.origin))return `${DEFAULT_RETURN_ORIGIN}/`;u.search='';u.hash='';return u.toString();}catch{return `${DEFAULT_RETURN_ORIGIN}/`;}}
function redirectWithStatus(returnTo:string,status:string,message=''){const u=new URL(safeReturnTo(returnTo));u.searchParams.set('gmail',status);if(message)u.searchParams.set('gmail_message',message.slice(0,220));return new Response(null,{status:302,headers:{Location:u.toString(),'Cache-Control':'no-store'}});}

async function serviceFetch(path:string,init:any={}){const key=serviceKey(),r=await fetch(`${baseUrl()}${path}`,{...init,headers:{apikey:key,Authorization:`Bearer ${key}`,...(init.headers||{})}});const text=await r.text();let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||String(body||`Supabase service request failed (${r.status}).`));return body;}
async function browserRpc(name:string,payload:any={}){const key=publishableKey();if(!key)throw new Error('Supabase publishable key is unavailable.');const r=await fetch(`${baseUrl()}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(payload||{})});const text=await r.text();let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}if(!r.ok)throw new Error(body?.message||body?.error||body?.hint||String(body||`Supabase RPC ${name} failed (${r.status}).`));return body;}
async function serviceRpc(name:string,payload:any={}){return serviceFetch(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});}
async function verifySession(token:string){if(!token)throw new Error('Sign in to Assurance Regent before connecting Google Workspace.');const x=await browserRpc('assurance_regent_browser_agent_context',{p_token:token});const actor=x?.actor||null;if(!actor?.id)throw new Error('The signed-in Assurance Regent user could not be verified.');return actor;}
async function credentials(){const x=await serviceRpc('assurance_regent_gmail_oauth_credentials',{});const clientId=clean(x?.client_id,500),clientSecret=clean(x?.client_secret,500);if(!clientId||!clientSecret)throw new Error('Google OAuth client credentials are not configured in Supabase Vault.');return {clientId,clientSecret};}

async function getConnection(actorId:string){const rows=await serviceFetch(`/rest/v1/assurance_regent_gmail_connections?actor_id=eq.${encodeURIComponent(actorId)}&select=actor_id,company_id,gmail_email,google_subject,refresh_token,granted_scope,updated_at,last_used_at,revoked_at&limit=1`,{headers:{Accept:'application/json'}});return rows?.[0]||null;}
async function deleteConnection(actorId:string){await serviceFetch(`/rest/v1/assurance_regent_gmail_connections?actor_id=eq.${encodeURIComponent(actorId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});}
async function touchConnection(actorId:string){await serviceFetch(`/rest/v1/assurance_regent_gmail_connections?actor_id=eq.${encodeURIComponent(actorId)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({last_used_at:new Date().toISOString(),updated_at:new Date().toISOString()})});}
async function upsertConnection(row:any){const rows=await serviceFetch('/rest/v1/assurance_regent_gmail_connections?on_conflict=actor_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});return rows?.[0]||row;}
async function insertState(row:any){await serviceFetch('/rest/v1/assurance_regent_gmail_oauth_states',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});}
async function getState(hash:string){const rows=await serviceFetch(`/rest/v1/assurance_regent_gmail_oauth_states?state_hash=eq.${encodeURIComponent(hash)}&select=*&limit=1`,{headers:{Accept:'application/json'}});return rows?.[0]||null;}
async function markStateUsed(hash:string){await serviceFetch(`/rest/v1/assurance_regent_gmail_oauth_states?state_hash=eq.${encodeURIComponent(hash)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({used_at:new Date().toISOString()})});}
async function cleanupStates(){try{await serviceFetch(`/rest/v1/assurance_regent_gmail_oauth_states?expires_at=lt.${encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString())}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});}catch{}}

async function createAuthorization(actor:any,returnTo:any){const {clientId}=await credentials(),state=randomState(),stateHash=await sha256Hex(state),now=Date.now(),safe=safeReturnTo(returnTo);await cleanupStates();await insertState({state_hash:stateHash,actor_id:String(actor.id),company_id:String(actor.companyId||''),login_hint:clean(actor.email,320),return_to:safe,created_at:new Date(now).toISOString(),expires_at:new Date(now+10*60*1000).toISOString()});const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',clientId);u.searchParams.set('redirect_uri',redirectUri());u.searchParams.set('response_type','code');u.searchParams.set('scope',OPENID_SCOPES);u.searchParams.set('access_type','offline');u.searchParams.set('include_granted_scopes','true');u.searchParams.set('prompt','consent select_account');u.searchParams.set('state',state);if(actor.email)u.searchParams.set('login_hint',String(actor.email));return {url:u.toString(),redirect_uri:redirectUri(),expires_in:600};}

async function tokenExchange(code:string){const {clientId,clientSecret}=await credentials(),form=new URLSearchParams();form.set('client_id',clientId);form.set('client_secret',clientSecret);form.set('code',code);form.set('redirect_uri',redirectUri());form.set('grant_type','authorization_code');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{};}catch{data={error_description:text};}if(!r.ok)throw new Error(data?.error_description||data?.error||`Google token exchange failed (${r.status}).`);return data;}
async function refreshAccess(refreshToken:string){const {clientId,clientSecret}=await credentials(),form=new URLSearchParams();form.set('client_id',clientId);form.set('client_secret',clientSecret);form.set('refresh_token',refreshToken);form.set('grant_type','refresh_token');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{};}catch{data={error_description:text};}if(!r.ok)throw new Error(data?.error_description||data?.error||`Google access-token refresh failed (${r.status}).`);return data;}
async function googleUser(accessToken:string){const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${accessToken}`}});const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{};}catch{data={};}if(!r.ok)throw new Error(data?.error_description||data?.error||`Google account lookup failed (${r.status}).`);return data;}

function recipients(value:string){const list=String(value||'').split(/[;,]/).map(x=>x.trim()).filter(Boolean);if(!list.length||list.length>20||list.some(x=>!isEmail(x)))throw new Error('A valid email recipient is required.');return list;}
function mimeMessage(from:string,to:string[],subject:string,body:string){const lines=[`From: ${from}`,`To: ${to.join(', ')}`,`Subject: ${encodedHeader(subject||'Message from Assurance Regent')}`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: 8bit','',body];return lines.join('\r\n');}
async function gmailSend(accessToken:string,from:string,to:string[],subject:string,body:string){const raw=base64UrlText(mimeMessage(from,to,subject,body)),r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({raw})});const text=await r.text();let data:any={};try{data=text?JSON.parse(text):{};}catch{data={error:{message:text}};}if(!r.ok)throw new Error(data?.error?.message||`Gmail rejected the message (${r.status}).`);return data;}

async function recruitmentTarget(token:string,applicationId:string){const bundle=await browserRpc('assurance_regent_browser_recruitment_bundle',{p_token:token}),app=(bundle?.applications||[]).find((x:any)=>String(x.id||'')===applicationId);if(!app)throw new Error('Recruitment application not found or not permitted.');if(!isEmail(String(app.email||'')))throw new Error('The applicant does not have a valid email address.');return app;}
async function logRecruitmentEmail(app:any,subject:string,body:string,providerRef:string){try{await serviceFetch('/rest/v1/assurance_regent_recruitment_outreach',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({company_id:app.company_id,application_id:app.id,channel:'email',recipient:app.email,subject,message:body,delivery_status:'SENT',provider:'gmail',created_by:'HR',provider_reference:providerRef||null})});}catch{try{await serviceFetch('/rest/v1/assurance_regent_recruitment_outreach',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({company_id:app.company_id,application_id:app.id,channel:'email',recipient:app.email,subject,message:body,delivery_status:'SENT',provider:'gmail',created_by:'HR'})});}catch{}}
}
async function logJivanEmail(token:string,to:string,subject:string,body:string,providerRef:string){try{await browserRpc('assurance_regent_browser_jivan_communication_log_append',{p_token:token,p_channel:'EMAIL',p_provider:'GMAIL',p_recipient:to,p_subject:subject,p_body_excerpt:body.slice(0,1200),p_status:'SENT',p_provider_reference:providerRef,p_metadata:{provider:'gmail',full_body:body.slice(0,12000)}});}catch{}try{await browserRpc('assurance_regent_browser_agent_audit_append',{p_token:token,p_event_type:'EXTERNAL_COMMUNICATION',p_action:'EMAIL',p_target:to,p_status:'OK',p_detail:'Email sent through connected Gmail account.',p_metadata:{provider:'GMAIL',provider_reference:providerRef}});}catch{}}

Deno.serve(async(req:any)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    if(req.method==='GET'){
      const u=new URL(req.url),code=clean(u.searchParams.get('code'),4000),state=clean(u.searchParams.get('state'),4000),oauthError=clean(u.searchParams.get('error'),300);
      if(!state)return json({error:'Missing Google OAuth state.'},400);
      const stateHash=await sha256Hex(state),saved=await getState(stateHash);if(!saved||saved.used_at||new Date(saved.expires_at).getTime()<Date.now())return json({error:'This Google authorization request has expired or was already used.'},400);
      await markStateUsed(stateHash);
      if(oauthError)return redirectWithStatus(saved.return_to,'error',oauthError);
      if(!code)return redirectWithStatus(saved.return_to,'error','Google did not return an authorization code.');
      try{
        const tokens=await tokenExchange(code),access=clean(tokens?.access_token,5000);if(!access)throw new Error('Google did not return an access token.');const profile=await googleUser(access),gmail=clean(profile?.email,320).toLowerCase();if(!isEmail(gmail))throw new Error('The connected Google account did not provide an email address.');const existing=await getConnection(String(saved.actor_id)),refresh=clean(tokens?.refresh_token,5000)||clean(existing?.refresh_token,5000);if(!refresh)throw new Error('Google did not return a refresh token. Reconnect Google Workspace and approve offline access.');await upsertConnection({actor_id:String(saved.actor_id),company_id:String(saved.company_id||''),gmail_email:gmail,google_subject:clean(profile?.sub,240),refresh_token:refresh,granted_scope:clean(tokens?.scope||OPENID_SCOPES,2000),created_at:existing?.actor_id?existing.created_at||new Date().toISOString():new Date().toISOString(),updated_at:new Date().toISOString(),last_used_at:existing?.last_used_at||null,revoked_at:null});return redirectWithStatus(saved.return_to,'connected');
      }catch(err:any){return redirectWithStatus(saved.return_to,'error',String(err?.message||err));}
    }

    if(req.method!=='POST')return json({error:'Use POST for Google connector actions.'},405);
    const body=await req.json().catch(()=>({})),action=clean(body?.action,60).toLowerCase(),token=clean(body?.session_token,5000),actor=await verifySession(token);

    if(action==='status'){
      let configured=true;try{await credentials();}catch{configured=false;}const c=await getConnection(String(actor.id)),meetScope=Boolean(c&&String(c.granted_scope||'').split(/\s+/).includes(MEET_READ_SCOPE));return json({ok:true,connected:Boolean(c&&!c.revoked_at&&c.refresh_token),email:c?.gmail_email||'',updated_at:c?.updated_at||'',last_used_at:c?.last_used_at||'',client_configured:configured,redirect_uri:redirectUri(),provider:'GMAIL',meet_scope:meetScope});
    }
    if(action==='authorize_url'){
      const x=await createAuthorization(actor,body?.return_to);return json({ok:true,...x,provider:'GOOGLE_WORKSPACE'});
    }
    if(action==='disconnect'){
      const c=await getConnection(String(actor.id));if(c?.refresh_token){try{const form=new URLSearchParams();form.set('token',c.refresh_token);await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});}catch{}}await deleteConnection(String(actor.id));return json({ok:true,connected:false,provider:'GMAIL'});
    }
    if(action==='send'){
      const source=clean(body?.source,40).toLowerCase();if(!['recruitment','jivan'].includes(source))return json({error:'This Gmail send source is not permitted.'},403);
      let to=recipients(clean(body?.to,1200)),subject=clean(body?.subject,500)||'Message from Assurance Regent',message=clean(body?.body,12000);if(!message)return json({error:'Email message content is required.'},400);let app:any=null;
      if(source==='recruitment'){
        const appId=clean(body?.metadata?.application_id,120);if(!appId)return json({error:'Recruitment application ID is required.'},400);app=await recruitmentTarget(token,appId);to=recipients(String(app.email||''));
      }else if(String(actor.role||'')!=='Developer')return json({error:'Developer authority is required for Jivan external email.'},403);
      const c=await getConnection(String(actor.id));if(!c||c.revoked_at||!c.refresh_token){const auth=await createAuthorization(actor,body?.return_to);return json({error:'Connect Gmail before sending email.',code:'GMAIL_NOT_CONNECTED',needs_auth:true,auth_url:auth.url,redirect_uri:auth.redirect_uri},409);}
      let access:any;try{access=await refreshAccess(c.refresh_token);}catch(err:any){await deleteConnection(String(actor.id)).catch(()=>{});const auth=await createAuthorization(actor,body?.return_to);return json({error:'The Google authorization expired or was revoked. Reconnect Google Workspace.',code:'GMAIL_RECONNECT_REQUIRED',needs_auth:true,auth_url:auth.url,redirect_uri:auth.redirect_uri,detail:String(err?.message||err).slice(0,300)},409);}
      const sent=await gmailSend(clean(access?.access_token,5000),String(c.gmail_email),to,subject,message);await touchConnection(String(actor.id));if(source==='recruitment')await logRecruitmentEmail(app,subject,message,String(sent?.id||''));else await logJivanEmail(token,to.join(', '),subject,message,String(sent?.id||''));return json({ok:true,sent:true,provider:'gmail',provider_reference:String(sent?.id||''),thread_id:String(sent?.threadId||''),from:c.gmail_email,to});
    }
    return json({error:'Unknown Google connector action.'},400);
  }catch(err:any){const message=String(err?.message||err||'Google connector failed.');const status=/sign in|session|verified/i.test(message)?401:/not permitted|authority/i.test(message)?403:/not configured/i.test(message)?503:400;return json({error:message},status);}
});
