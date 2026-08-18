// Assurance Regent v6.3.81 — Developer-managed Google Meet Media API connector
// Uses Google's restricted audio-only Media API scope. Refresh tokens remain server-side.
// v6.3.81 pins the verified interview space supplied from Google conference records and
// confirms a currently active conference before a Meet Media client is issued credentials.
const DenoRuntime=globalThis.Deno;

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
};
const PLATFORM_ACTOR_ID='Dvp';
const MEDIA_AUDIO_SCOPE='https://www.googleapis.com/auth/meetings.conference.media.audio.readonly';
const MEDIA_SPACE_SCOPE='https://www.googleapis.com/auth/meetings.space.read';
const REST_SPACE_SCOPE='https://www.googleapis.com/auth/meetings.space.readonly';
const OPENID_SCOPES=`openid email ${MEDIA_AUDIO_SCOPE} ${MEDIA_SPACE_SCOPE} ${REST_SPACE_SCOPE}`;
const DEFAULT_RETURN_ORIGIN='https://ar-intel.netlify.app';
const VERIFIED_INTERVIEW_SPACE='spaces/TcCnPqiVfn0B';
const ALLOWED_AUTHORITIES=new Set(['DEVELOPER','CEO','ADMINISTRATOR','HR_MANAGER']);

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function env(name){return String(DenoRuntime?.env?.get(name)||'').trim();}
function baseUrl(){const v=env('SUPABASE_URL');if(!v)throw new Error('SUPABASE_URL is not configured.');return v.replace(/\/$/,'');}
function serviceKey(){const v=env('SUPABASE_SERVICE_ROLE_KEY');if(!v)throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');return v;}
function publishableKey(){const raw=env('SUPABASE_PUBLISHABLE_KEYS');if(raw){try{const x=JSON.parse(raw);if(x?.default)return String(x.default);const first=Object.values(x||{})[0];if(first)return String(first);}catch{}}return env('SUPABASE_PUBLISHABLE_KEY')||env('SUPABASE_ANON_KEY');}
function clean(v,max=12000){return String(v??'').trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').slice(0,max);}
function isEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
function isDeveloper(ctx){return String(ctx?.actor?.id||'')===PLATFORM_ACTOR_ID||String(ctx?.authority||'').toUpperCase()==='DEVELOPER'||String(ctx?.actor?.role||'').toLowerCase()==='developer';}
function hasScope(c,scope){return Boolean(c&&String(c.granted_scope||'').split(/\s+/).includes(scope));}
async function sha256Hex(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function bytesBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary);}
function base64UrlBytes(bytes){return bytesBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function randomState(){const b=new Uint8Array(32);crypto.getRandomValues(b);return base64UrlBytes(b);}
function redirectUri(){return `${baseUrl()}/functions/v1/meet-media-connector`;}
function allowedReturnOrigins(){return new Set([DEFAULT_RETURN_ORIGIN,...env('GMAIL_ALLOWED_RETURN_ORIGINS').split(',').map(x=>x.trim()).filter(Boolean)]);}
function safeReturnTo(value){try{const u=new URL(String(value||DEFAULT_RETURN_ORIGIN));if(!allowedReturnOrigins().has(u.origin))return `${DEFAULT_RETURN_ORIGIN}/`;u.search='';u.hash='';return u.toString();}catch{return `${DEFAULT_RETURN_ORIGIN}/`;}}
function popupResult(returnTo,status,message=''){
  const safe=safeReturnTo(returnTo),origin=new URL(safe).origin,type=status==='connected'?'assurance-regent-meet-media-connected':'assurance-regent-meet-media-error';
  const payload=JSON.stringify({type,status,message:String(message||'').slice(0,300)}),target=JSON.stringify(origin);
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Assurance Regent · Google Meet Media</title></head><body style="font-family:system-ui;padding:28px"><h3>${status==='connected'?'Google Meet Media connected':'Google Meet Media connection failed'}</h3><p>${status==='connected'?'You can return to Assurance Regent.':'Return to Assurance Regent and review Developer API connections.'}</p><script>try{window.opener&&window.opener.postMessage(${payload},${target});}catch(e){}setTimeout(()=>window.close(),350);<\/script></body></html>`;
  return new Response(html,{status:200,headers:{...cors,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

async function serviceFetch(path,init={}){const k=serviceKey(),r=await fetch(`${baseUrl()}${path}`,{...init,headers:{apikey:k,Authorization:`Bearer ${k}`,...(init.headers||{})}});const t=await r.text();let b=null;try{b=t?JSON.parse(t):null;}catch{b=t;}if(!r.ok)throw new Error(b?.message||b?.error||b?.hint||String(b||`Supabase service request failed (${r.status}).`));return b;}
async function browserRpc(name,payload={}){const k=publishableKey();if(!k)throw new Error('Supabase publishable key is unavailable.');const r=await fetch(`${baseUrl()}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:k,'Content-Type':'application/json'},body:JSON.stringify(payload||{})});const t=await r.text();let b=null;try{b=t?JSON.parse(t):null;}catch{b=t;}if(!r.ok)throw new Error(b?.message||b?.error||b?.hint||String(b||`RPC ${name} failed (${r.status}).`));return b;}
async function serviceRpc(name,payload={}){return serviceFetch(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});}
async function verifyContext(token){if(!token)throw new Error('Sign in to Assurance Regent before using Live Meet Assistant.');const ctx=await browserRpc('assurance_regent_browser_agent_context',{p_token:token});if(!ctx?.actor?.id)throw new Error('The signed-in Assurance Regent user could not be verified.');return ctx;}
async function credentials(){const x=await serviceRpc('assurance_regent_gmail_oauth_credentials',{});const clientId=clean(x?.client_id,500),clientSecret=clean(x?.client_secret,500);if(!clientId||!clientSecret)throw new Error('Google OAuth client credentials are not configured in Supabase Vault.');return {clientId,clientSecret};}

async function connection(){const rows=await serviceFetch(`/rest/v1/assurance_regent_meet_media_connections?actor_id=eq.${encodeURIComponent(PLATFORM_ACTOR_ID)}&select=actor_id,gmail_email,google_subject,refresh_token,granted_scope,created_at,updated_at,last_used_at,revoked_at&limit=1`,{headers:{Accept:'application/json'}});return rows?.[0]||null;}
async function deleteConnection(){await serviceFetch(`/rest/v1/assurance_regent_meet_media_connections?actor_id=eq.${encodeURIComponent(PLATFORM_ACTOR_ID)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});}
async function touchConnection(){await serviceFetch(`/rest/v1/assurance_regent_meet_media_connections?actor_id=eq.${encodeURIComponent(PLATFORM_ACTOR_ID)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({last_used_at:new Date().toISOString(),updated_at:new Date().toISOString()})});}
async function upsertConnection(row){const rows=await serviceFetch('/rest/v1/assurance_regent_meet_media_connections?on_conflict=actor_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({...row,actor_id:PLATFORM_ACTOR_ID})});return rows?.[0]||row;}
async function insertState(row){await serviceFetch('/rest/v1/assurance_regent_meet_media_oauth_states',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});}
async function getState(hash){const rows=await serviceFetch(`/rest/v1/assurance_regent_meet_media_oauth_states?state_hash=eq.${encodeURIComponent(hash)}&select=*&limit=1`,{headers:{Accept:'application/json'}});return rows?.[0]||null;}
async function markStateUsed(hash){await serviceFetch(`/rest/v1/assurance_regent_meet_media_oauth_states?state_hash=eq.${encodeURIComponent(hash)}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({used_at:new Date().toISOString()})});}
async function cleanupStates(){try{await serviceFetch(`/rest/v1/assurance_regent_meet_media_oauth_states?expires_at=lt.${encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString())}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});}catch{}}

async function createAuthorization(ctx,returnTo){
  if(!isDeveloper(ctx))throw new Error('Developer authority is required to manage Live Meet Media API connections.');
  const {clientId}=await credentials(),state=randomState(),stateHash=await sha256Hex(state),now=Date.now(),safe=safeReturnTo(returnTo);await cleanupStates();
  await insertState({state_hash:stateHash,actor_id:PLATFORM_ACTOR_ID,return_to:safe,created_at:new Date(now).toISOString(),expires_at:new Date(now+10*60*1000).toISOString()});
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',clientId);u.searchParams.set('redirect_uri',redirectUri());u.searchParams.set('response_type','code');u.searchParams.set('scope',OPENID_SCOPES);u.searchParams.set('access_type','offline');u.searchParams.set('include_granted_scopes','true');u.searchParams.set('prompt','consent select_account');u.searchParams.set('state',state);if(ctx?.actor?.email)u.searchParams.set('login_hint',String(ctx.actor.email));
  return {url:u.toString(),redirect_uri:redirectUri(),expires_in:600};
}
async function tokenExchange(code){const {clientId,clientSecret}=await credentials(),form=new URLSearchParams();form.set('client_id',clientId);form.set('client_secret',clientSecret);form.set('code',code);form.set('redirect_uri',redirectUri());form.set('grant_type','authorization_code');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});const t=await r.text();let b={};try{b=t?JSON.parse(t):{};}catch{b={error_description:t};}if(!r.ok)throw new Error(b?.error_description||b?.error||`Google token exchange failed (${r.status}).`);return b;}
async function refreshAccess(refreshToken){const {clientId,clientSecret}=await credentials(),form=new URLSearchParams();form.set('client_id',clientId);form.set('client_secret',clientSecret);form.set('refresh_token',refreshToken);form.set('grant_type','refresh_token');const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});const t=await r.text();let b={};try{b=t?JSON.parse(t):{};}catch{b={error_description:t};}if(!r.ok)throw new Error(b?.error_description||b?.error||`Google token refresh failed (${r.status}).`);return b;}
async function googleUser(accessToken){const r=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${accessToken}`}});const t=await r.text();let b={};try{b=t?JSON.parse(t):{};}catch{}if(!r.ok)throw new Error(b?.error_description||b?.error||`Google account lookup failed (${r.status}).`);return b;}
function normalizeSpaceName(value){const raw=clean(value,300);if(!raw)return '';return raw.startsWith('spaces/')?raw:`spaces/${raw.replace(/^spaces\//,'')}`;}
async function googleMeetJson(url,accessToken,label){const r=await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});const t=await r.text();let b={};try{b=t?JSON.parse(t):{};}catch{b={error:{message:t}};}if(!r.ok)throw new Error(b?.error?.message||b?.message||`${label||'Google Meet request'} failed (${r.status}).`);return b;}
async function getSpace(spaceOrMeetingCode,accessToken){const spaceName=normalizeSpaceName(spaceOrMeetingCode);if(!spaceName)throw new Error('Google Meet space reference is required.');return googleMeetJson(`https://meet.googleapis.com/v2/${encodeURI(spaceName)}`,accessToken,'Google Meet space lookup');}
async function activeConferenceRecord(spaceName,accessToken){
  const canonical=normalizeSpaceName(spaceName);if(!canonical)return null;
  const u=new URL('https://meet.googleapis.com/v2/conferenceRecords');u.searchParams.set('pageSize','10');u.searchParams.set('filter',`space.name = "${canonical.replace(/"/g,'')}" AND end_time IS NULL`);
  const b=await googleMeetJson(u.toString(),accessToken,'Google Meet active conference lookup'),rows=Array.isArray(b?.conferenceRecords)?b.conferenceRecords:[];
  return rows.find(x=>x&&!x.endTime)||null;
}
async function resolveInterviewSpace(meetingCode,accessToken){
  const code=clean(meetingCode,160).toLowerCase(),byCode=await getSpace(code,accessToken);let space=byCode,verified=false;
  try{const known=await getSpace(VERIFIED_INTERVIEW_SPACE,accessToken),knownCode=clean(known?.meetingCode,160).toLowerCase(),byCodeName=normalizeSpaceName(byCode?.name);if(byCodeName===VERIFIED_INTERVIEW_SPACE||knownCode===code){space=known;verified=true;}}catch{}
  const spaceName=normalizeSpaceName(space?.name),spaceId=spaceName.startsWith('spaces/')?spaceName.slice(7):spaceName;if(!spaceId)return {space,spaceName:'',spaceId:'',activeConference:null,activeConferenceSource:'',verified};
  let activeConference=space?.activeConference?.conferenceRecord||space?.activeConference?.name||space?.activeConference||null,activeConferenceSource=activeConference?'space.activeConference':'';
  if(!activeConference){const record=await activeConferenceRecord(spaceName,accessToken);if(record?.name){activeConference=record.name;activeConferenceSource='conferenceRecords.list';}}
  return {space,spaceName,spaceId,activeConference,activeConferenceSource,verified};
}
function meetCode(url){try{const u=new URL(String(url||''));if(u.hostname!=='meet.google.com')return '';return clean(u.pathname.split('/').filter(Boolean)[0],160).toLowerCase();}catch{return '';}}
async function recruitmentInterview(token,id){const bundle=await browserRpc('assurance_regent_browser_recruitment_bundle',{p_token:token}),row=(bundle?.interviews||[]).find(x=>String(x.id||'')===String(id||''));return {bundle,row};}

DenoRuntime.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    if(req.method==='GET'){
      const u=new URL(req.url),code=clean(u.searchParams.get('code'),4000),state=clean(u.searchParams.get('state'),4000),oauthError=clean(u.searchParams.get('error'),300);if(!state)return json({error:'Missing Google OAuth state.'},400);
      const hash=await sha256Hex(state),saved=await getState(hash);if(!saved||saved.used_at||new Date(saved.expires_at).getTime()<Date.now())return json({error:'This Live Meet Media authorization request expired or was already used.'},400);await markStateUsed(hash);
      if(oauthError)return popupResult(saved.return_to,'error',oauthError);if(!code)return popupResult(saved.return_to,'error','Google did not return an authorization code.');
      try{const tokens=await tokenExchange(code),access=clean(tokens?.access_token,5000);if(!access)throw new Error('Google did not return an access token.');const profile=await googleUser(access),email=clean(profile?.email,320).toLowerCase();if(!isEmail(email))throw new Error('The connected Google account did not provide an email address.');const existing=await connection(),refresh=clean(tokens?.refresh_token,5000)||clean(existing?.refresh_token,5000);if(!refresh)throw new Error('Google did not return a refresh token. Reconnect and approve offline access.');await upsertConnection({gmail_email:email,google_subject:clean(profile?.sub,240),refresh_token:refresh,granted_scope:clean(tokens?.scope||OPENID_SCOPES,2500),created_at:existing?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),last_used_at:existing?.last_used_at||null,revoked_at:null});return popupResult(saved.return_to,'connected');}catch(err){return popupResult(saved.return_to,'error',String(err?.message||err));}
    }

    if(req.method!=='POST')return json({error:'POST is required for Live Meet Media actions.'},405);
    const body=await req.json().catch(()=>({})),action=clean(body?.action,60).toLowerCase(),token=clean(body?.session_token,5000),ctx=await verifyContext(token),developer=isDeveloper(ctx),c=await connection(),mediaReady=Boolean(c&&!c.revoked_at&&c.refresh_token&&hasScope(c,MEDIA_AUDIO_SCOPE)&&hasScope(c,MEDIA_SPACE_SCOPE));

    if(action==='status'){
      let configured=true;try{await credentials();}catch{configured=false;}
      if(!developer)return json({ok:true,ready:mediaReady,shared:true,provider:'GOOGLE_MEET_MEDIA'});
      return json({ok:true,ready:mediaReady,connected:Boolean(c&&!c.revoked_at&&c.refresh_token),email:c?.gmail_email||'',media_scope:hasScope(c,MEDIA_AUDIO_SCOPE),space_scope:hasScope(c,MEDIA_SPACE_SCOPE),rest_space_scope:hasScope(c,REST_SPACE_SCOPE),client_configured:configured,redirect_uri:redirectUri(),verified_space_name:VERIFIED_INTERVIEW_SPACE,updated_at:c?.updated_at||'',last_used_at:c?.last_used_at||'',shared:true,management:true,provider:'GOOGLE_MEET_MEDIA'});
    }
    if(action==='authorize_url'){
      if(!developer)return json({error:'Developer authority is required to manage Live Meet Media API connections.'},403);const x=await createAuthorization(ctx,body?.return_to);return json({ok:true,...x,provider:'GOOGLE_MEET_MEDIA'});
    }
    if(action==='disconnect'){
      if(!developer)return json({error:'Developer authority is required to manage Live Meet Media API connections.'},403);if(c?.refresh_token){try{const form=new URLSearchParams();form.set('token',c.refresh_token);await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});}catch{}}await deleteConnection();return json({ok:true,ready:false,connected:false,provider:'GOOGLE_MEET_MEDIA'});
    }
    if(action==='session'){
      const authority=String(ctx?.authority||'').toUpperCase();if(!ALLOWED_AUTHORITIES.has(authority))return json({error:'Human Resources interview authority is required to start Jivan Live Meet Assistant.'},403);
      if(!mediaReady)return json({error:'Live Meet Assistant is not connected. Contact the Developer.',code:'MEET_MEDIA_NOT_CONNECTED'},409);
      const interviewId=clean(body?.interview_id,180);if(!interviewId)return json({error:'Interview ID is required.'},400);const {row}=await recruitmentInterview(token,interviewId);if(!row)return json({error:'Interview not found or not permitted.'},404);if(authority!=='DEVELOPER'&&String(row.company_id||row.companyId||'')!==String(ctx?.actor?.companyId||''))return json({error:'This interview belongs to another company.'},403);
      const code=meetCode(row.meet_url||row.meetUrl);if(!code)return json({error:'This interview does not have a valid Google Meet room.'},400);
      let access;try{access=await refreshAccess(String(c.refresh_token));}catch(err){return json({error:'Live Meet Assistant authorization expired. Contact the Developer to reconnect it.',code:'MEET_MEDIA_RECONNECT_REQUIRED',detail:String(err?.message||err).slice(0,240)},409);}const accessToken=clean(access?.access_token,5000);if(!accessToken)return json({error:'Google did not return a Live Meet access token.'},502);
      const resolved=await resolveInterviewSpace(code,accessToken);if(!resolved.spaceId)return json({error:'Google Meet did not return a meeting space ID.'},502);if(!resolved.activeConference)return json({error:'The Google Meet room is not currently active. Join/start the interview room first, ensure the connected Google principal is present, then bring Jivan live.',code:'NO_ACTIVE_CONFERENCE',space_name:resolved.spaceName,verified_space:resolved.verified},409);
      await touchConnection();return json({ok:true,ready:true,meeting_space_id:resolved.spaceId,space_name:resolved.spaceName,meeting_code:clean(resolved.space?.meetingCode||code,160),active_conference:resolved.activeConference,active_conference_source:resolved.activeConferenceSource,verified_space:resolved.verified,verified_space_name:VERIFIED_INTERVIEW_SPACE,access_token:accessToken,expires_in:Number(access?.expires_in||3600),token_type:clean(access?.token_type||'Bearer',40),audio_only:true,shared:true,authenticated_principal_must_be_present:true});
    }
    return json({error:'Unknown Live Meet Media action.'},400);
  }catch(err){const m=String(err?.message||err||'Live Meet Media connector failed.');const status=/sign in|session|verified/i.test(m)?401:/authority|another company|not permitted/i.test(m)?403:/not configured/i.test(m)?503:400;return json({error:m},status);}
});
