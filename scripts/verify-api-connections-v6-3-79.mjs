import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const gmailFile=resolve(root,'supabase/functions/gmail-connector/index.ts'),meetFile=resolve(root,'supabase/functions/meet-interview-assistant/index.ts');
for(const file of [gmailFile,meetFile])if(!existsSync(file))throw new Error(`Missing server connector source: ${file}`);

for(const file of targets.filter(existsSync)){
  const s=readFileSync(file,'utf8');
  const start=s.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START'),end=s.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing END');
  if(start<0||end<start)throw new Error(`API connections v6.3.79 block missing in ${basename(file)}.`);
  const b=s.slice(start,end);
  const required=[
    "const API_CONNECTIONS_PAGE79='api-connections'",
    "String(u?.id||'')==='Dvp'",
    "String(u?.role||'').toLowerCase()==='developer'",
    "nav.hidden=!developer",
    "section.hidden=true",
    "renderGmailProfile77=function(){removeLegacyApiConnectionUi79();};",
    "ensureGmailConnected77=async function",
    "throw apiConnectionsGenericUnavailable79('email')",
    "ensureMeetScope78=async function",
    "throw apiConnectionsGenericUnavailable79('interview')",
    "renderMeetInterviewAssistant78=async function",
    "data-api-google-connect79",
    "Google Workspace connected platform-wide",
    "one Developer connection serves all users"
  ];
  for(const token of required)if(!b.includes(token))throw new Error(`API connections v6.3.79 missing client boundary ${token} in ${basename(file)}.`);
  if(/<button[^>]+data-meet-connect78|data-meet-connect78[^\n]{0,160}>Connect Meet access/u.test(b))throw new Error(`Meet connection control is rendered in Recruitment UI in ${basename(file)}.`);
  if(!b.includes("document.querySelectorAll('[data-meet-connect78]').forEach(x=>x.remove())"))throw new Error(`Legacy Meet connection controls are not explicitly removed in ${basename(file)}.`);
  if(/GOCSPX-[A-Za-z0-9_-]{10,}/u.test(s))throw new Error(`Google client secret leaked into ${basename(file)}.`);
}

const gmail=readFileSync(gmailFile,'utf8'),meet=readFileSync(meetFile,'utf8');
for(const token of [
  "const PLATFORM_ACTOR_ID='Dvp'",
  'async function platformConnection()',
  "if(action==='authorize_url')",
  "if(!developer)return json({error:'Developer authority is required to manage API connections.'},403)",
  "if(action==='disconnect')",
  "const c=await platformConnection();",
  "Email service is currently unavailable. Contact the Developer.",
  "connection_scope:'PLATFORM'"
])if(!gmail.includes(token))throw new Error(`Gmail connector v6.3.79 missing ${token}.`);
if(gmail.includes('const c=await getConnection(String(actor.id))'))throw new Error('Gmail connector still uses per-user OAuth connection.');
if(gmail.includes('GMAIL_NOT_CONNECTED')||gmail.includes('GMAIL_RECONNECT_REQUIRED'))throw new Error('Gmail connector still exposes per-user OAuth connection requirements.');
if(/GOCSPX-[A-Za-z0-9_-]{10,}/u.test(gmail))throw new Error('Google client secret leaked into Gmail Edge Function source.');

for(const token of[
  "const PLATFORM_ACTOR_ID='Dvp'",
  'async function platformConnection()',
  "const c=await platformConnection()",
  "Jivan interview notes are currently unavailable. Contact the Developer.",
  'shared:true',
  'api_key_configured',
  'jivan_configured'
])if(!meet.includes(token))throw new Error(`Meet assistant v6.3.79 missing ${token}.`);
if(meet.includes('connection(String(actor.id))'))throw new Error('Meet assistant still uses per-user Google connection.');
if(meet.includes('MEET_SCOPE_REQUIRED')||meet.includes('needs_auth:true'))throw new Error('Meet assistant still exposes per-user OAuth setup behavior.');

console.log('[verify-api-connections] Developer-only Settings page present.');
console.log('[verify-api-connections] Gmail and Meet use one platform Developer OAuth connection.');
console.log('[verify-api-connections] Non-Developer users receive service behavior without OAuth/API administration controls.');
