import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');
const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');
const runtimePath=resolve(root,'scripts/gmail-oauth-v6-3-77-runtime.inc.js'),edgePath=resolve(root,'supabase/functions/gmail-connector/index.ts'),sqlPath=resolve(root,'supabase/GMAIL_OAUTH_CONNECTOR_V6_3_77.sql');
for(const path of [runtimePath,edgePath,sqlPath])if(!existsSync(path))throw new Error(`Gmail OAuth required file missing: ${path}`);
const runtime=readFileSync(runtimePath,'utf8'),edge=readFileSync(edgePath,'utf8'),sql=readFileSync(sqlPath,'utf8');

for(const token of ['Assurance Regent v6.3.77 — Gmail OAuth outbound email integration','GMAIL_OAUTH_REDIRECT_URI77','baseSupabaseFunction77','gmailConnectorRequest77','ensureGmailConnected77','data-gmail-connect77','data-gmail-disconnect77','assurance-regent-gmail-connected',"name==='recruitment-public'", "payload?.channel||'').toLowerCase()==='email'", "name==='recovery-agent'", "payload?.channel||'').toUpperCase()==='EMAIL'", "provider:'GMAIL'"])if(!app.includes(token))throw new Error(`Published Gmail OAuth behavior missing: ${token}`);
if(!app.includes("return gmailConnectorRequest77({action:'send',source:'recruitment'"))throw new Error('Recruitment Send Email is not routed through Gmail connector.');
if(!app.includes("return gmailConnectorRequest77({action:'send',source:'jivan'"))throw new Error('Jivan external email is not routed through Gmail connector.');
if(!app.includes("name==='recovery-agent'&&String(payload?.mode||'').toLowerCase()==='studio_status'"))throw new Error('Developer Studio email diagnostics are not overlaid with Gmail status.');
if(!app.includes("card.querySelector('h3').textContent='Gmail'"))throw new Error('Developer Studio does not relabel the outbound email connector as Gmail.');

for(const token of ['https://accounts.google.com/o/oauth2/v2/auth','https://oauth2.googleapis.com/token','https://gmail.googleapis.com/gmail/v1/users/me/messages/send','https://www.googleapis.com/auth/gmail.send',"action==='authorize_url'", "action==='status'", "action==='disconnect'", "action==='send'", "source==='recruitment'", "source==='jivan'",'GMAIL_NOT_CONNECTED','GMAIL_RECONNECT_REQUIRED'])if(!edge.includes(token))throw new Error(`Gmail Edge Function behavior missing: ${token}`);
for(const token of ['assurance_regent_gmail_connections','assurance_regent_gmail_oauth_states','assurance_regent_gmail_oauth_credentials','vault.decrypted_secrets','service_role'])if(!sql.includes(token))throw new Error(`Gmail database protection missing: ${token}`);

const secretPattern=/GOCSPX-[A-Za-z0-9_-]{10,}/u;for(const [label,text] of [['published app',app],['client runtime',runtime],['Gmail Edge Function',edge],['Gmail SQL',sql]])if(secretPattern.test(text))throw new Error(`Security regression: OAuth client secret is present in ${label}.`);
if(/clientSecret\s*=\s*['"][^'"]+['"]/u.test(edge)||/client_secret\s*[:=]\s*['"][^'"]+['"]/u.test(edge))throw new Error('Security regression: Gmail Edge Function contains a hard-coded client secret.');
if(!edge.includes("serviceRpc('assurance_regent_gmail_oauth_credentials'"))throw new Error('Gmail Edge Function is not retrieving OAuth credentials through the server-only credential RPC.');
if(!sql.includes("revoke all on function public.assurance_regent_gmail_oauth_credentials() from public, anon, authenticated"))throw new Error('Gmail credential RPC is not revoked from browser roles.');

const appCheck=spawnSync(process.execPath,['--check',appPath],{encoding:'utf8'});if(appCheck.status!==0)throw new Error(`Published app syntax check failed:\n${appCheck.stderr||appCheck.stdout}`);
const runtimeCheck=spawnSync(process.execPath,['--check',runtimePath],{encoding:'utf8'});if(runtimeCheck.status!==0)throw new Error(`Gmail client runtime syntax check failed:\n${runtimeCheck.stderr||runtimeCheck.stdout}`);
console.log('[gmail-oauth-verify] OK: Recruitment and Jivan outbound email actions route through the Gmail connector.');
console.log('[gmail-oauth-verify] OK: Gmail OAuth connect/disconnect/status UI and popup callback flow are present.');
console.log('[gmail-oauth-verify] OK: OAuth client secret is absent from browser and repository connector source.');
console.log('[gmail-oauth-verify] OK: refresh tokens and OAuth state are server-only; client credentials are read from Supabase Vault.');
