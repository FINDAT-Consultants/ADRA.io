import { createClient } from 'npm:@supabase/supabase-js@2';
import { Agent, run, tool, setDefaultOpenAIKey } from 'npm:@openai/agents@0.14.3';
import { z } from 'npm:zod@4';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

/**
 * Assurance Regent — Supabase-only application backend.
 *
 * This single Edge Function is the complete hosted backend; no separate application server is used.
 * It is intended to be created and edited directly in the Supabase Dashboard.
 *
 * Required Edge Function secrets:
 *   OPENAI_API_KEY
 *   DEVELOPER_BOOTSTRAP_PASSWORD
 * Optional:
 *   OPENAI_MODEL (default: gpt-5.4)
 *   APP_ALLOWED_ORIGINS (comma-separated; default: *)
 *
 * Supabase provides SUPABASE_URL and privileged project credentials to hosted
 * Edge Functions. The browser never receives the OpenAI or service-role secret.
 */

type Json = Record<string, any>;
type Envelope = { method?: string; path?: string; query?: Record<string,string>; body?: any };

const now = () => new Date().toISOString();
const clean = (v:any) => String(v ?? '').trim();
const uid = (prefix='ID') => `${prefix}-${crypto.randomUUID()}`;
const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
const lower = (v:any) => clean(v).toLowerCase();
const monthKey = (v:any) => {
  const s=clean(v); if(!s) return '';
  const d = /^\d{4}-\d{2}/.test(s) ? s.slice(0,7) : new Date(s).toISOString().slice(0,7);
  return `${d}-01`;
};

function serviceKey(){
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if(direct) return direct;
  try{
    const parsed=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
    const first=Object.values(parsed).find(v=>typeof v==='string'&&String(v).trim());
    if(first) return String(first);
  }catch{}
  throw new Error('Supabase privileged Edge credential is unavailable.');
}
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const db = createClient(supabaseUrl, serviceKey(), { auth:{persistSession:false,autoRefreshToken:false} });

function originAllowed(origin:string){
  const raw=clean(Deno.env.get('APP_ALLOWED_ORIGINS')||'*');
  if(raw==='*') return '*';
  const allowed=raw.split(',').map(x=>x.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : (allowed[0]||'null');
}
function cors(req:Request){
  const origin=originAllowed(req.headers.get('origin')||'');
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers':'content-type, apikey, x-client-info, x-assurance-session',
    'access-control-allow-methods':'POST, OPTIONS',
    'access-control-max-age':'86400',
    'vary':'Origin'
  };
}
function reply(req:Request, body:any, status=200){
  return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
function errStatus(e:any){ return Number(e?.statusCode||e?.status||500) || 500; }
function fail(message:string,status=400){const e:any=new Error(message);e.statusCode=status;throw e;}

async function readState(key:string, fallback:any){
  const {data,error}=await db.from('app_state_documents').select('state_value').eq('state_key',key).maybeSingle();
  if(error) throw error;
  if(data?.state_value!==undefined && data?.state_value!==null) return data.state_value;
  await writeState(key,fallback);
  return clone(fallback);
}
async function writeState(key:string,value:any){
  const {error}=await db.from('app_state_documents').upsert({state_key:key,state_value:value,updated_at:now()},{onConflict:'state_key'});
  if(error) throw error;
  return value;
}

function hashPassword(password:string,salt=randomBytes(16).toString('hex')){
  return `${salt}:${scryptSync(String(password),salt,64).toString('hex')}`;
}
function verifyPassword(password:string,stored=''){
  try{
    const [salt,hex]=String(stored).split(':'); if(!salt||!hex)return false;
    const a=Buffer.from(hex,'hex'),b=scryptSync(String(password),salt,64);
    return a.length===b.length&&timingSafeEqual(a,b);
  }catch{return false;}
}
async function sha256(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function newToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}

const ROLE_DEVELOPER='Developer', ROLE_ADMIN='Administrator', ROLE_EMPLOYEE='Employee';
function permissionsFor(user:any){
  if(!user)return {role:'Signed out',allowedViews:[],canReview:false,canManageSettings:false,canManageUsers:false,canCreateCompanies:false,canAssignAdministrators:false,canManageMasterData:false,canManagePayroll:false,canUploadDocuments:false};
  if(user.role===ROLE_DEVELOPER)return {role:user.role,allowedViews:['*'],canReview:true,canManageSettings:true,canManageUsers:true,canCreateCompanies:true,canAssignAdministrators:true,canManageMasterData:true,canManagePayroll:true,canUploadDocuments:true};
  if(user.role===ROLE_ADMIN)return {role:user.role,allowedViews:['dashboard','company','assistant','insights','reports','work','time','employees','recruiting','onboarding','projects','payroll','calendar','monthly','checks','voucher'],canReview:true,canManageSettings:true,canManageUsers:true,canCreateCompanies:false,canAssignAdministrators:true,canManageMasterData:true,canManagePayroll:true,canUploadDocuments:true};
  return {role:user.role,allowedViews:['dashboard','company','assistant','work','time','employees','calendar'],canReview:false,canManageSettings:false,canManageUsers:false,canCreateCompanies:false,canAssignAdministrators:false,canManageMasterData:false,canManagePayroll:false,canUploadDocuments:true};
}
function publicUser(user:any){if(!user)return null;const {passwordHash,hiddenFromDirectory,...safe}=user;return safe;}

async function controlDefault(){
  const bootstrap=clean(Deno.env.get('DEVELOPER_BOOTSTRAP_PASSWORD'));
  if(!bootstrap) fail('DEVELOPER_BOOTSTRAP_PASSWORD Edge Function secret is not configured.',503);
  return {
    version:3,
    settings:{countryCode:'',country:'Not configured',currency:'USD',currencyName:'US Dollar',defaultHourlyRate:0,employeeHourlyRates:{},projectHourlyRates:{}},
    companies:[{id:'COMPANY-DEFAULT',name:'System Workspace',code:'DEFAULT',active:true,hidden:true,system:true,createdAt:now(),createdBy:'Dvp'}],
    users:[{id:'Dvp',username:'Dvp',name:'Developer',email:'',position:'System Developer',companyId:'',role:ROLE_DEVELOPER,profilePhoto:'',passwordHash:hashPassword(bootstrap),hiddenFromDirectory:true,active:true,createdAt:now()}],
    documents:[],reviews:[],reviewResolutions:{}
  };
}
async function readControl(){
  const fallback=await controlDefault();
  const c=await readState('control_center',fallback);
  c.settings={...fallback.settings,...(c.settings||{})};
  c.companies=Array.isArray(c.companies)?c.companies:fallback.companies;
  c.users=Array.isArray(c.users)?c.users:fallback.users;
  c.documents=Array.isArray(c.documents)?c.documents:[];
  c.reviews=Array.isArray(c.reviews)?c.reviews:[];
  c.reviewResolutions=c.reviewResolutions||{};
  if(!c.users.some((u:any)=>u.id==='Dvp')) c.users.unshift(fallback.users[0]);
  return c;
}
async function issueSession(userId:string){
  const token=newToken(),token_hash=await sha256(token);
  const expires_at=new Date(Date.now()+12*60*60*1000).toISOString();
  const {error}=await db.from('app_auth_sessions').insert({token_hash,user_id:userId,expires_at,created_at:now(),updated_at:now()});
  if(error) throw error;
  return token;
}
async function revokeSession(token:string){
  if(!token)return;
  const {error}=await db.from('app_auth_sessions').delete().eq('token_hash',await sha256(token));
  if(error) throw error;
}
async function actorFromRequest(req:Request, required=true){
  const token=clean(req.headers.get('x-assurance-session'));
  if(!token){if(required)fail('Sign in is required.',401);return null;}
  const token_hash=await sha256(token);
  const {data,error}=await db.from('app_auth_sessions').select('user_id,expires_at').eq('token_hash',token_hash).maybeSingle();
  if(error) throw error;
  if(!data || new Date(data.expires_at).getTime()<=Date.now()){
    await db.from('app_auth_sessions').delete().eq('token_hash',token_hash);
    if(required)fail('Your session has expired. Please sign in again.',401);return null;
  }
  const c=await readControl();
  const user=c.users.find((u:any)=>u.id===data.user_id && u.active!==false) || null;
  if(!user&&required)fail('Account not found or disabled.',401);
  return user;
}
function requireRole(actor:any,roles:string[]){if(!actor||!roles.includes(actor.role))fail('You do not have permission for this action.',403);}
function companyIdFor(actor:any, requested:any=''){return actor?.role===ROLE_DEVELOPER?(clean(requested)||'COMPANY-DEFAULT'):(clean(actor?.companyId)||'COMPANY-DEFAULT');}
function rowVisibleToCompany(row:any,actor:any){if(actor?.role===ROLE_DEVELOPER)return true;const cid=clean(row?.company_id||row?.companyId||row?.metadata?.company_id);return !cid||cid===clean(actor?.companyId);}
function filterCompanyRows(rows:any[],actor:any){return (rows||[]).filter(row=>rowVisibleToCompany(row,actor));}

function visibleUsers(c:any,actor:any){return c.users.filter((u:any)=>!u.hiddenFromDirectory&&(actor.role===ROLE_DEVELOPER||u.companyId===actor.companyId)).map(publicUser);}
function visibleCompanies(c:any,actor:any){const rows=c.companies.filter((x:any)=>x.active!==false&&!x.hidden&&!x.system);return actor.role===ROLE_DEVELOPER?rows:rows.filter((x:any)=>x.id===actor.companyId);}
async function controlPayload(actor:any){
  const c=await readControl();
  const documents=c.documents.filter((d:any)=>actor.role===ROLE_DEVELOPER||(actor.role===ROLE_ADMIN&&d.companyId===actor.companyId)||(actor.role===ROLE_EMPLOYEE&&d.employeeId===actor.id)).map(({data,...rest}:any)=>rest);
  const storedReviews=c.reviews.filter((r:any)=>r.status==='PENDING'&&(actor.role===ROLE_DEVELOPER||r.companyId===actor.companyId));
  const {data:taskData}=await db.from('system_records').select('*').eq('record_type','task').in('status',['active','pending','open']).order('created_at',{ascending:false}).limit(250);
  const tasks=filterCompanyRows(taskData||[],actor).filter((t:any)=>actor.role!==ROLE_EMPLOYEE||!t.metadata?.assigned_to||[actor.id,actor.name,actor.email,'all','everyone'].filter(Boolean).map(lower).includes(lower(t.metadata?.assigned_to)));
  let messageQuery=db.from('mts_messages').select('*').eq('read',false).order('created_at',{ascending:false}).limit(500);
  if(actor.role!==ROLE_DEVELOPER)messageQuery=messageQuery.eq('company_id',companyIdFor(actor));
  const {data:messages}=await messageQuery;
  const identities=new Set([actor.id,actor.name,actor.email,'all','everyone','system'].filter(Boolean).map(lower));
  const myMessages=(messages||[]).filter((m:any)=>identities.has(lower(m.recipient)));
  const thread=await readState(`brain_thread:${actor.id}`,{messages:[]});
  const advisorMessages=(thread.messages||[]).filter((m:any)=>m.role==='assistant'&&m.unread===true);
  const notifications=[
    ...storedReviews.map((r:any)=>({id:`review:${r.id}`,kind:'review',title:r.title||'Approval required',detail:r.detail||'',created_at:r.createdAt||r.created_at||'',review_id:r.id,status:r.status})),
    ...tasks.map((t:any)=>({id:`task:${t.id}`,kind:'task',title:t.title,detail:t.content,created_at:t.created_at,task_id:t.id,status:t.status})),
    ...advisorMessages.map((m:any)=>({id:`advisor:${m.id}`,kind:'advisor',title:'Recovery Agent',detail:m.content,created_at:m.created_at,advisor_message_id:m.id,status:'AI ADVICE'})),
    ...myMessages.map((m:any)=>({id:`message:${m.id}`,kind:'message',title:`Message from ${m.sender||'System'}`,detail:m.content,created_at:m.created_at,message_id:m.id,status:'UNREAD'}))
  ];
  const settings=actor.role===ROLE_EMPLOYEE?{countryCode:c.settings.countryCode,country:c.settings.country,currency:c.settings.currency,currencyName:c.settings.currencyName,defaultHourlyRate:0,employeeHourlyRates:{},projectHourlyRates:{}}:c.settings;
  return {profile:{signedIn:true,currentUser:publicUser(actor),users:visibleUsers(c,actor),permissions:permissionsFor(actor),companies:visibleCompanies(c,actor)},settings,documents,reviews:storedReviews,messages:myMessages,advisorMessages,tasks,notifications,brain:{configured:Boolean(Deno.env.get('OPENAI_API_KEY')),model:Deno.env.get('OPENAI_MODEL')||'gpt-5.4',runtime:'supabase-edge'}};
}

const EMPTY_LIVE={employees:[],projects:[],payroll:[],calendar:[],timeEntries:[],sources:[],sourceChecks:[],vacancies:[],candidates:[],onboarding:[]};
async function liveState(){const s=await readState('live_system_data',EMPTY_LIVE);for(const k of Object.keys(EMPTY_LIVE))if(!Array.isArray(s[k]))s[k]=[];return s;}
async function saveLive(s:any){await writeState('live_system_data',s);return s;}
function scopeLive(s:any,actor:any){
  if(actor.role===ROLE_DEVELOPER)return clone(s);
  const cid=actor.companyId;
  const out:any={};
  for(const [k,v] of Object.entries(s)) out[k]=Array.isArray(v)?(v as any[]).filter(x=>!x.companyId||x.companyId===cid):v;
  if(actor.role===ROLE_EMPLOYEE){out.timeEntries=(out.timeEntries||[]).filter((x:any)=>x.employeeId===actor.id);}
  return out;
}
function upsertArray(arr:any[],row:any,keys:string[]){
  const idx=arr.findIndex(x=>keys.every(k=>clean(x[k])===clean(row[k])));
  if(idx>=0)arr[idx]={...arr[idx],...row};else arr.push(row);
  return idx>=0?arr[idx]:arr[arr.length-1];
}

function projectPredictions(activity:string,projects:any[],limit=5){
  const words=(v:any)=>new Set(lower(v).match(/[a-z0-9]+/g)||[]),target=words(activity);
  const scored=projects.map(p=>{
    const bag=words(`${p.code||''} ${p.name||''} ${p.donor||''}`),inter=[...target].filter(x=>bag.has(x)).length,union=new Set([...target,...bag]).size||1;
    const score=inter/union + (lower(activity).includes(lower(p.code))&&p.code?0.55:0);
    return {label:p.code||p.projectCode||'',confidence:Math.min(.98,Math.max(.05,score)),advisory:true,quality:'SUPABASE_LIVE',humanConfirmationRequired:true,confidenceBand:score>=.75?'HIGH':score>=.5?'MEDIUM':'LOW'};
  }).filter(x=>x.label).sort((a,b)=>b.confidence-a.confidence).slice(0,limit);
  return scored;
}

async function logAction(action_name:string,input_data:any={},result_data:any={},status='completed',session_id=''){
  const {error}=await db.from('agent_action_log').insert({session_id,action_name,input_data,result_data,status,created_at:now()});
  if(error) console.error('action log',error.message);
}

async function runRecoveryAgent(actor:any,message:string){
  const apiKey=clean(Deno.env.get('OPENAI_API_KEY'));
  if(!apiKey) fail('OPENAI_API_KEY is not configured in Supabase Edge Function Secrets.',503);
  setDefaultOpenAIKey(apiKey);
  const model=clean(Deno.env.get('OPENAI_MODEL'))||'gpt-5.4';
  const getOperationalState=tool({
    name:'get_operational_state',
    description:'Read the current Supabase-backed workforce, projects, payroll, time, recruiting and onboarding state visible to the current user.',
    parameters:z.object({}),
    execute:async()=>JSON.stringify(scopeLive(await liveState(),actor))
  });
  const searchMemoryTool=tool({
    name:'search_memory',description:'Search durable Assurance Regent memory stored in Supabase.',
    parameters:z.object({query:z.string().min(1),limit:z.number().int().min(1).max(20).optional()}),
    execute:async({query,limit})=>{const q=clean(query);const {data,error}=await db.from('agent_memories').select('*').or(`title.ilike.%${q.replace(/[%_,]/g,'')}%,content.ilike.%${q.replace(/[%_,]/g,'')}%`).order('importance',{ascending:false}).limit(Math.max((limit||8)*4,24));if(error)throw error;return JSON.stringify(filterCompanyRows(data||[],actor).slice(0,limit||8));}
  });
  const saveMemoryTool=tool({
    name:'save_memory',description:'Save a durable non-sensitive operational fact or confirmed policy to Supabase memory.',
    parameters:z.object({title:z.string().min(1),content:z.string().min(1),category:z.string().optional(),importance:z.number().min(0).max(1).optional()}),
    execute:async({title,content,category,importance})=>{const {data,error}=await db.from('agent_memories').insert({title,content,category:category||'fact',authority:'CONFIRMED',importance:importance??0.7,source_type:'edge_agent',source_ref:actor.id,tags:[],metadata:{actor_id:actor.id,company_id:companyIdFor(actor)},session_id:actor.id,created_at:now(),updated_at:now()}).select('*').single();if(error)throw error;return JSON.stringify(data);}
  });
  const createTaskTool=tool({
    name:'create_follow_up_task',description:'Create an internal follow-up task in Supabase. Use only when the user clearly asks for a task or action to be tracked.',
    parameters:z.object({title:z.string().min(1),detail:z.string().min(1),assignee:z.string().optional()}),
    execute:async({title,detail,assignee})=>{const {data,error}=await db.from('system_records').insert({record_type:'task',title,content:detail,status:'active',metadata:{assigned_to:assignee||actor.id,created_by_agent:true,company_id:actor.companyId||''},source:'supabase_edge_agent',session_id:actor.id,created_at:now(),updated_at:now()}).select('*').single();if(error)throw error;return JSON.stringify(data);}
  });
  const agent=new Agent({
    name:'Assurance Regent Recovery Agent',
    model,
    instructions:`You are the Assurance Regent Human Capital Intelligence Recovery Agent. You run inside Supabase Edge Functions. Use Supabase-backed tools when the user asks about live company data or prior confirmed memory. Never invent payroll, hours, approvals, donor eligibility, or posting status. Explain uncertainty clearly. Human approval remains authoritative for controlled financial and HR decisions. Current signed-in actor: ${actor.name} (${actor.role}), company ${actor.companyId||'system'}.`,
    tools:[getOperationalState,searchMemoryTool,saveMemoryTool,createTaskTool]
  });
  const thread=await readState(`brain_thread:${actor.id}`,{messages:[]});
  const recent=(thread.messages||[]).slice(-16).map((m:any)=>`${m.role==='assistant'?'Assistant':'User'}: ${m.content}`).join('\n');
  const input=recent?`Conversation so far:\n${recent}\n\nUser: ${message}`:message;
  const activityRunId=uid('RUN');
  await writeState(`agent_activity:${activityRunId}`,{events:[{sequence:1,type:'run_started',label:'Supabase Edge agent started',detail:model,created_at:now()}]});
  const result=await run(agent,input,{maxTurns:8});
  const text=clean(result.finalOutput)||'No response was produced.';
  const stamped=now();
  const msgs=thread.messages||[];
  msgs.push({id:uid('MSG'),role:'user',content:message,source:'user',created_at:stamped,unread:false});
  msgs.push({id:uid('MSG'),role:'assistant',content:text,source:'agent',created_at:now(),unread:false});
  thread.messages=msgs.slice(-300); await writeState(`brain_thread:${actor.id}`,thread);
  await writeState(`agent_activity:${activityRunId}`,{events:[{sequence:1,type:'run_started',label:'Supabase Edge agent started',detail:model,created_at:stamped},{sequence:2,type:'run_completed',label:'Agent response completed',detail:'OpenAI Agents SDK',created_at:now()}]});
  await logAction('brain_chat',{actor_id:actor.id,message_length:message.length},{activity_run_id:activityRunId},'completed',actor.id);
  return {output_text:text,requires_approval:false,approvals:[],approval_state:'',brain_session_id:actor.id,session_id:actor.id,activity_run_id:activityRunId,executed_actions:[],llm_configured:true,runtime:'supabase-edge',model};
}

async function handle(req:Request,e:Envelope){
  const method=clean(e.method||'GET').toUpperCase(),path=clean(e.path||'/api/health'),q=e.query||{},body=e.body||{};

  if(path==='/api/health') return {status:200,body:{ok:true,runtime:'supabase-edge-only',database:'supabase-postgres',storage:'supabase-storage',openai:{configured:Boolean(Deno.env.get('OPENAI_API_KEY')),runtime:'edge-function',model:Deno.env.get('OPENAI_MODEL')||'gpt-5.4'}}};

  if(path==='/api/control-center/login'&&method==='POST'){
    const c=await readControl(),username=clean(body.username||body.userId),password=clean(body.password),requested=clean(body.role||body.userType);
    if(!username||!password)fail('Username and password are required.');
    const user=c.users.find((u:any)=>u.active!==false&&(lower(u.username||u.id)===lower(username)||lower(u.id)===lower(username)));
    if(!user||!verifyPassword(password,user.passwordHash))fail('Invalid username or password.',401);
    if(user.role!==ROLE_DEVELOPER&&requested&&requested!==user.role)fail(`This account is registered as ${user.role}.`,401);
    return {status:200,body:{signedIn:true,currentUser:publicUser(user),permissions:permissionsFor(user),session_token:await issueSession(user.id)}};
  }
  if(path==='/api/control-center/register'&&method==='POST'){
    const c=await readControl(),id=clean(body.userId||body.username),role=clean(body.role||body.userType)||ROLE_EMPLOYEE,password=clean(body.password),name=clean(body.name),position=clean(body.position),companyCode=clean(body.companyCode);
    if(!id||!password||!name||!position||!companyCode)fail('User ID, company code, name, position and password are required.');
    if(password.length<8)fail('Password must contain at least 8 characters.');
    if(![ROLE_ADMIN,ROLE_EMPLOYEE].includes(role))fail('Choose Administrator or Employee registration.');
    if(c.users.some((u:any)=>lower(u.id)===lower(id)||lower(u.username)===lower(id)))fail('That username is already registered.');
    const company=c.companies.find((x:any)=>lower(x.code)===lower(companyCode)&&x.active!==false&&!x.hidden);if(!company)fail('A valid Developer-created company code is required.');
    if(role===ROLE_ADMIN&&c.users.some((u:any)=>u.role===ROLE_ADMIN&&u.companyId===company.id&&u.active!==false))fail('This company already has an Administrator.');
    const user={id,username:id,name,email:clean(body.email),position,department:'',supervisor:'',supervisoryRole:'',companyId:company.id,role,profilePhoto:'',passwordHash:hashPassword(password),hiddenFromDirectory:false,active:true,createdAt:now()};
    c.users.push(user);await writeState('control_center',c);
    return {status:201,body:{signedIn:true,currentUser:publicUser(user),permissions:permissionsFor(user),session_token:await issueSession(user.id)}};
  }

  const actor=await actorFromRequest(req,true);

  if(path==='/api/control-center'&&method==='GET')return {status:200,body:await controlPayload(actor)};
  if(path==='/api/control-center/logout'&&method==='POST'){await revokeSession(clean(req.headers.get('x-assurance-session')));return {status:200,body:{signedIn:false}};}
  if(path==='/api/control-center/settings'&&method==='PATCH'){
    requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const c=await readControl();c.settings={...c.settings,...body};await writeState('control_center',c);return {status:200,body:c.settings};
  }
  if(path==='/api/control-center/profile'&&method==='PATCH'){
    const c=await readControl(),u=c.users.find((x:any)=>x.id===actor.id);if(!u)fail('User not found.',404);
    for(const k of ['name','email','position','department','supervisor','supervisoryRole','profilePhoto'])if(body[k]!==undefined)u[k]=body[k];
    await writeState('control_center',c);return {status:200,body:publicUser(u)};
  }
  if(path==='/api/control-center/companies'&&method==='POST'){
    requireRole(actor,[ROLE_DEVELOPER]);const c=await readControl(),name=clean(body.name||body.companyName),code=clean(body.code||body.companyCode).toUpperCase();if(!name||!code)fail('Company name and code are required.');if(c.companies.some((x:any)=>lower(x.code)===lower(code)))fail('Company code already exists.');const row={id:uid('COMPANY'),name,code,active:true,hidden:false,system:false,createdAt:now(),createdBy:actor.id};c.companies.push(row);await writeState('control_center',c);return {status:201,body:row};
  }
  if(path==='/api/control-center/companies/executive'&&method==='POST'){
    requireRole(actor,[ROLE_DEVELOPER]);const c=await readControl(),name=clean(body.companyName||body.name),code=clean(body.companyCode||body.code).toUpperCase(),userId=clean(body.userId||body.username),password=clean(body.password),execName=clean(body.executiveName||body.nameOfExecutive||body.fullName||body.userName||body.accountName||body.employeeName||body.name),position=clean(body.position||body.executivePosition||'Country Director');
    if(!name||!code||!userId||password.length<8)fail('Company name, company code, executive username and an 8-character password are required.');
    if(c.companies.some((x:any)=>lower(x.code)===lower(code)))fail('Company code already exists.');
    if(c.users.some((x:any)=>lower(x.id)===lower(userId)))fail('That username already exists.');
    const company={id:uid('COMPANY'),name,code,active:true,hidden:false,system:false,createdAt:now(),createdBy:actor.id};c.companies.push(company);
    const user={id:userId,username:userId,name:clean(body.executiveName||body.fullName||body.employeeName)||execName||userId,email:clean(body.email),position,department:clean(body.department),companyId:company.id,role:ROLE_ADMIN,profilePhoto:'',passwordHash:hashPassword(password),hiddenFromDirectory:false,active:true,createdAt:now(),createdBy:actor.id};c.users.push(user);await writeState('control_center',c);return {status:201,body:{company,user:publicUser(user)}};
  }
  if(path==='/api/control-center/users'&&method==='POST'){
    requireRole(actor,[ROLE_DEVELOPER]);const c=await readControl(),id=clean(body.userId||body.username),password=clean(body.password),companyId=clean(body.companyId),role=clean(body.role)||ROLE_EMPLOYEE;if(!id||password.length<8||!companyId)fail('Company, username and an 8-character password are required.');if(c.users.some((x:any)=>lower(x.id)===lower(id)))fail('That username already exists.');const user={id,username:id,name:clean(body.name)||id,email:clean(body.email),position:clean(body.position),department:clean(body.department),companyId,role:[ROLE_ADMIN,ROLE_EMPLOYEE].includes(role)?role:ROLE_EMPLOYEE,profilePhoto:'',passwordHash:hashPassword(password),hiddenFromDirectory:false,active:true,createdAt:now(),createdBy:actor.id};c.users.push(user);await writeState('control_center',c);return {status:201,body:publicUser(user)};
  }
  let m=path.match(/^\/api\/control-center\/users\/([^/]+)$/);
  if(m&&method==='DELETE'){
    requireRole(actor,[ROLE_DEVELOPER]);const id=decodeURIComponent(m[1]);if(id==='Dvp')fail('Developer account cannot be deleted.');const c=await readControl();c.users=c.users.filter((x:any)=>x.id!==id);await writeState('control_center',c);return {status:200,body:{deleted:true,id}};
  }
  m=path.match(/^\/api\/control-center\/users\/([^/]+)\/role$/);
  if(m&&method==='PATCH'){
    requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const id=decodeURIComponent(m[1]),c=await readControl(),u=c.users.find((x:any)=>x.id===id);if(!u)fail('User not found.',404);if(actor.role===ROLE_ADMIN&&u.companyId!==actor.companyId)fail('Administrators may only manage users in their company.',403);for(const k of ['role','position','department','supervisor','supervisoryRole'])if(body[k]!==undefined)u[k]=body[k];await writeState('control_center',c);return {status:200,body:publicUser(u)};
  }
  if(path==='/api/control-center/documents'&&method==='POST'){
    const c=await readControl();const companyId=actor.role===ROLE_DEVELOPER?clean(body.companyId)||'COMPANY-DEFAULT':actor.companyId;const employeeId=actor.role===ROLE_EMPLOYEE?actor.id:clean(body.employeeId)||actor.id;const row={id:uid('DOC'),name:clean(body.name)||'Document',type:clean(body.type)||'application/octet-stream',size:Number(body.size||0),data:body.data||'',employeeId,employeeName:clean(body.employeeName)||actor.name,department:clean(body.department),projectCode:clean(body.projectCode),companyId,status:'PENDING_REVIEW',source:clean(body.source)||'Upload',sourceRef:clean(body.sourceRef),revision:Number(body.revision||1),createdAt:now(),uploadedBy:actor.id,assignedTo:''};c.documents.unshift(row);await writeState('control_center',c);return {status:201,body:{...row,data:undefined}};
  }
  m=path.match(/^\/api\/control-center\/documents\/([^/]+)\/content$/);
  if(m&&method==='GET'){
    const id=decodeURIComponent(m[1]),c=await readControl(),d=c.documents.find((x:any)=>x.id===id);if(!d)fail('Document not found.',404);if(!(actor.role===ROLE_DEVELOPER||(actor.role===ROLE_ADMIN&&d.companyId===actor.companyId)||(actor.role===ROLE_EMPLOYEE&&d.employeeId===actor.id)))fail('You do not have access to this document.',403);return {status:200,body:{id:d.id,name:d.name,type:d.type,data:d.data,status:d.status,archivePath:d.archivePath||'',archiveFile:d.archiveFile||'',archiveStorageBucket:d.archiveStorageBucket||''}};
  }
  m=path.match(/^\/api\/control-center\/documents\/([^/]+)\/review$/);
  if(m&&method==='POST'){
    requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const id=decodeURIComponent(m[1]),c=await readControl(),d=c.documents.find((x:any)=>x.id===id);if(!d)fail('Document not found.',404);if(actor.role===ROLE_ADMIN&&d.companyId!==actor.companyId)fail('This document belongs to another company.',403);const decision=lower(body.action);if(!['approve','reject'].includes(decision))fail('Choose approve or reject.');d.status=decision==='approve'?'APPROVED':'REJECTED';d.reviewedBy=actor.id;d.reviewedAt=now();d.reviewNote=clean(body.note);if(decision==='approve'&&d.data&&/^data:/i.test(d.data)){try{const [head,payload]=String(d.data).split(',',2),bytes=Uint8Array.from(atob(payload||''),c=>c.charCodeAt(0)),mime=(head.match(/^data:([^;,]+)/i)||[])[1]||d.type||'application/octet-stream',storagePath=`${clean(d.companyId)||'company'}/${clean(d.projectCode)||'unassigned'}/${clean(d.employeeId)||'user'}/${d.id}-${clean(d.name).replace(/[^a-z0-9._-]+/gi,'-')}`;const {error}=await db.storage.from('approved-documents').upload(storagePath,bytes,{contentType:mime,upsert:true});if(!error){d.archiveFile=storagePath;d.archiveStorageBucket='approved-documents';d.archivePath=`${d.department||'Unassigned'} / ${d.projectCode||'Unassigned'} / ${d.employeeName||d.employeeId}`;}}catch(error){d.reviewNote=[d.reviewNote,`Archive warning: ${String(error)}`].filter(Boolean).join(' · ');}}await writeState('control_center',c);return {status:200,body:{...d,data:undefined}};
  }
  if(path==='/api/control-center/reviews/agent'&&method==='POST'){
    const c=await readControl(),row={id:clean(body.id)||uid('AGENT-REVIEW'),kind:'AGENT_ACTION',title:'Recovery Agent action approval',detail:clean(body.detail)||'A Recovery Agent action is waiting for review.',status:'PENDING',assignedTo:'',companyId:companyIdFor(actor),actionMode:'agent',sourceRef:clean(body.sourceRef),approvalState:clean(body.approvalState),sessionId:clean(body.sessionId),approvals:Array.isArray(body.approvals)?body.approvals:[],createdAt:now()};c.reviews.unshift(row);await writeState('control_center',c);return {status:201,body:row};
  }
  m=path.match(/^\/api\/control-center\/reviews\/([^/]+)\/(action|resolve)$/);
  if(m&&['POST','PATCH'].includes(method)){
    requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const id=decodeURIComponent(m[1]),c=await readControl(),r=c.reviews.find((x:any)=>x.id===id);if(!r)fail('Review item not found.',404);r.status='RESOLVED';r.decision=clean(body.action||body.decision||'resolved');r.reviewedBy=actor.id;r.reviewedAt=now();r.note=clean(body.note);await writeState('control_center',c);return {status:200,body:r};
  }
  m=path.match(/^\/api\/control-center\/tasks\/([^/]+)\/complete$/);
  if(m&&method==='PATCH'){const id=decodeURIComponent(m[1]);const {data,error}=await db.from('system_records').update({status:'completed',updated_at:now()}).eq('id',id).select('*').maybeSingle();if(error)throw error;return {status:200,body:data||{id,status:'completed'}};}

  if(path==='/api/live/state'&&method==='GET')return {status:200,body:scopeLive(await liveState(),actor)};
  const liveRoutes:any={
    '/api/live/employees':'employees','/api/live/projects':'projects','/api/live/payroll':'payroll','/api/live/calendar':'calendar','/api/live/time':'timeEntries','/api/live/vacancies':'vacancies','/api/live/candidates':'candidates','/api/live/onboarding':'onboarding'
  };
  if(liveRoutes[path]&&method==='POST'){
    if(actor.role===ROLE_EMPLOYEE&&path!=='/api/live/time')fail('Administrator permission is required.',403);
    const s=await liveState(),cid=actor.role===ROLE_DEVELOPER?(clean(body.companyId||body.company_id)||'COMPANY-DEFAULT'):actor.companyId,key=liveRoutes[path];let row:any;
    if(key==='employees'){row={employeeId:clean(body.employeeId||body.employee_id),name:clean(body.name||body.employee_name),position:clean(body.position),supervisor:clean(body.supervisor),department:clean(body.department),team:clean(body.team),email:clean(body.email),phone:clean(body.phone),skype:clean(body.skype),profilePhoto:clean(body.profilePhoto||body.profile_photo),teamLead:Boolean(body.teamLead??body.team_lead),hoursPerDay:Number(body.hoursPerDay??body.hours_per_day??8),employmentType:clean(body.employmentType||body.employment_type),employmentStatus:clean(body.employmentStatus||body.employment_status)||'Active',location:clean(body.location),startDate:body.startDate||body.start_date||'',endDate:body.endDate||body.end_date||'',active:body.active||'Yes',companyId:cid};if(!row.employeeId)fail('Employee ID is required.');row=upsertArray(s.employees,row,['employeeId']);}
    else if(key==='projects'){row={code:clean(body.code||body.project_code),name:clean(body.name||body.project_name||body.code||body.project_code),donor:clean(body.donor),startDate:body.startDate||body.start_date||'',endDate:body.endDate||body.end_date||'',status:clean(body.status)||'Active',adminAllowed:body.adminAllowed||body.admin_allowed||'No',personnelBudget:Number(body.personnelBudget??body.personnel_budget??0),eligibleEmployeeId:clean(body.eligibleEmployeeId||body.eligible_employee_id),companyId:cid};if(!row.code)fail('Project code is required.');row=upsertArray(s.projects,row,['code']);}
    else if(key==='payroll'){row={month:monthKey(body.month),employeeId:clean(body.employeeId||body.employee_id),basicSalary:Number(body.basicSalary??body.basic_salary??0),benefits:Number(body.benefits||0),statutoryCost:Number(body.statutoryCost??body.statutory_cost??0),exclusions:Number(body.exclusions||0),source:clean(body.source)||'User input',configurationStatus:body.configurationStatus||body.configuration_status||'COMPLETE',notes:clean(body.notes),companyId:cid};if(!row.month||!row.employeeId)fail('Payroll month and employee are required.');row=upsertArray(s.payroll,row,['month','employeeId']);}
    else if(key==='calendar'){row={date:clean(body.date).slice(0,10),month:monthKey(body.date),dayType:body.dayType||body.day_type||'Working Day',standardHours:Number(body.standardHours??body.standard_hours??0),holidaySource:clean(body.holidaySource||body.holiday_source),companyId:cid};if(!row.date)fail('Calendar date is required.');row=upsertArray(s.calendar,row,['date','companyId']);}
    else if(key==='timeEntries'){const employeeId=actor.role===ROLE_EMPLOYEE?actor.id:clean(body.employeeId||body.employee_id);row={entryId:clean(body.entryId||body.entry_id)||uid('TIME'),date:clean(body.date).slice(0,10),month:monthKey(body.date),employeeId,employee:clean(body.employeeName||body.employee_name)||employeeId,projectCode:clean(body.projectCode||body.project_code),activity:clean(body.activity||body.activity_description),hours:Number(body.hours||0),status:clean(body.status)||'Draft',aiSuggestedProject:clean(body.aiSuggestedProject||body.ai_suggested_project),aiConfidence:Number(body.aiConfidence??body.ai_confidence??0),employeeDecision:body.employeeDecision||body.employee_decision||'Accepted',companyId:cid};if(!row.date||!row.employeeId||!row.projectCode||!(row.hours>0))fail('Date, employee, project and positive hours are required.');if(!row.aiSuggestedProject){const p=projectPredictions(row.activity,s.projects,1)[0];row.aiSuggestedProject=p?.label||row.projectCode;row.aiConfidence=p?.confidence||0;}row=upsertArray(s.timeEntries,row,['entryId']);}
    else if(key==='vacancies'){row={id:clean(body.id||body.vacancy_id)||uid('VAC'),title:clean(body.title||body.job_title),department:clean(body.department),location:clean(body.location),employmentType:clean(body.employmentType||body.employment_type)||'Full Time',status:clean(body.status)||'Open',openDate:body.openDate||body.open_date||'',closeDate:body.closeDate||body.close_date||'',companyId:cid};row=upsertArray(s.vacancies,row,['id']);}
    else if(key==='candidates'){row={id:clean(body.id||body.candidate_id)||uid('CAN'),name:clean(body.name||body.candidate_name),email:clean(body.email),phone:clean(body.phone),vacancyId:clean(body.vacancyId||body.vacancy_id),jobTitle:clean(body.jobTitle||body.job_title),department:clean(body.department),location:clean(body.location),employmentType:clean(body.employmentType||body.employment_type)||'Full Time',stage:clean(body.stage)||'Applied',status:clean(body.status)||'Active',profilePhoto:clean(body.profilePhoto||body.profile_photo),appliedDate:body.appliedDate||body.applied_date||'',notes:clean(body.notes),companyId:cid};row=upsertArray(s.candidates,row,['id']);}
    else {row={id:clean(body.id||body.onboarding_id)||uid('ONB'),candidateId:clean(body.candidateId||body.candidate_id),employeeId:clean(body.employeeId||body.employee_id),name:clean(body.name||body.employee_name),jobTitle:clean(body.jobTitle||body.job_title),department:clean(body.department),location:clean(body.location),employmentType:clean(body.employmentType||body.employment_type)||'Full Time',hireDate:body.hireDate||body.hire_date||'',profilePhoto:clean(body.profilePhoto||body.profile_photo),step:Number(body.step||1),status:clean(body.status)||'In Progress',checklist:body.checklist||{},companyId:cid};row=upsertArray(s.onboarding,row,['id']);}
    await saveLive(s);return {status:201,body:row};
  }

  if(path==='/api/intelligence/status'&&method==='GET'){const s=await liveState();return {status:200,body:{version:3,updatedAt:now(),quality:s.timeEntries.length>=30?'LIVE_LEARNING':s.timeEntries.length?'EARLY_LIVE':'NO_TRAINING_DATA',featureStore:{liveCodingRows:s.timeEntries.length,totalTrainingRows:s.timeEntries.length},metrics:{projectClasses:s.projects.length},openAI:{configured:Boolean(Deno.env.get('OPENAI_API_KEY')),runtime:'supabase-edge'}}};}
  if(path==='/api/intelligence/project-coding'&&method==='GET'){const s=await liveState();return {status:200,body:projectPredictions(q.activity||q.q||'',s.projects,Number(q.limit||5))};}
  if(path==='/api/intelligence/train'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const s=await liveState(),row={updatedAt:now(),reason:clean(body.reason)||'manual',quality:s.timeEntries.length>=30?'LIVE_LEARNING':s.timeEntries.length?'EARLY_LIVE':'NO_TRAINING_DATA',rows:s.timeEntries.length};await writeState('ml_models',row);return {status:200,body:row};}
  if(path==='/api/intelligence/insights'&&method==='GET'){const s=scopeLive(await liveState(),actor),hours=s.timeEntries.reduce((a:number,x:any)=>a+Number(x.hours||0),0);return {status:200,body:{generatedAt:now(),summary:{employees:s.employees.length,projects:s.projects.length,timeEntries:s.timeEntries.length,totalHours:hours},anomalies:[],advisories:[]}};}

  if(path==='/api/mts/sessions'&&method==='GET'){
    let query=db.from('mts_work_sessions').select('*').order('clock_in_at',{ascending:false}).limit(Math.min(Number(q.limit||500),5000));if(q.month){const start=`${String(q.month).slice(0,7)}-01`,d=new Date(`${start}T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()+1);query=query.gte('work_date',start).lt('work_date',d.toISOString().slice(0,10));}if(actor.role!==ROLE_DEVELOPER)query=query.eq('company_id',companyIdFor(actor));if(actor.role===ROLE_EMPLOYEE)query=query.eq('employee_id',actor.id);const {data,error}=await query;if(error)throw error;return {status:200,body:data||[]};
  }
  if(path==='/api/mts/clock-in'&&method==='POST'){
    const row={id:uid('MTS'),company_id:companyIdFor(actor,body.company_id||body.companyId),employee_id:actor.role===ROLE_EMPLOYEE?actor.id:clean(body.employee_id||body.employeeId)||actor.id,employee_name:actor.role===ROLE_EMPLOYEE?actor.name:clean(body.employee_name||body.employeeName)||actor.name,department:clean(body.department),project_code:clean(body.project_code||body.projectCode),activity_description:clean(body.activity_description||body.activity),work_date:clean(body.work_date||body.date||now()).slice(0,10),clock_in_at:body.clock_in_at||body.clockInAt||now(),clock_out_at:null,duration_hours:0,completion_percent:0,on_time:Boolean(body.on_time??body.onTime),delay_comments:clean(body.delay_comments||body.delayComments),clock_in_location:clean(body.clock_in_location||body.clockInLocation),clock_out_location:'',clock_in_lat:body.clock_in_lat??body.clockInLat??null,clock_in_lng:body.clock_in_lng??body.clockInLng??null,clock_out_lat:null,clock_out_lng:null,document_name:'',document_type:'',document_size:0,document_data:'',status:'active',locked:false,recovery_entry_id:null,recovery_bridge_status:'pending_clock_out',source:'live',created_at:now(),updated_at:now()};if(!row.project_code||!row.activity_description)fail('Project and activity description are required.');const {data,error}=await db.from('mts_work_sessions').insert(row).select('*').single();if(error)throw error;return {status:201,body:data};
  }
  m=path.match(/^\/api\/mts\/sessions\/([^/]+)\/clock-out$/);
  if(m&&method==='POST'){
    const id=decodeURIComponent(m[1]);const {data:existing,error:e0}=await db.from('mts_work_sessions').select('*').eq('id',id).single();if(e0)throw e0;if(!rowVisibleToCompany(existing,actor))fail('This work session belongs to another company.',403);if(actor.role===ROLE_EMPLOYEE&&existing.employee_id!==actor.id)fail('This work session belongs to another employee.',403);const outAt=body.clock_out_at||body.clockOutAt||now(),hours=Math.max(0,(new Date(outAt).getTime()-new Date(existing.clock_in_at).getTime())/3600000),updates={clock_out_at:outAt,duration_hours:Number(body.duration_hours??body.durationHours??hours),completion_percent:Number(body.completion_percent??body.completionPercent??100),clock_out_location:clean(body.clock_out_location||body.clockOutLocation),clock_out_lat:body.clock_out_lat??body.clockOutLat??null,clock_out_lng:body.clock_out_lng??body.clockOutLng??null,document_name:clean(body.document_name||body.documentName),document_type:clean(body.document_type||body.documentType),document_size:Number(body.document_size??body.documentSize??0),document_data:body.document_data||body.documentData||'',status:'completed',locked:true,recovery_bridge_status:'draft_created',updated_at:now()};const s=await liveState(),entry={entryId:uid('TIME'),date:existing.work_date,month:monthKey(existing.work_date),employeeId:existing.employee_id,employee:existing.employee_name,projectCode:existing.project_code,activity:existing.activity_description,hours:updates.duration_hours,status:'Draft',aiSuggestedProject:existing.project_code,aiConfidence:1,employeeDecision:'Accepted',companyId:existing.company_id||companyIdFor(actor)};s.timeEntries.push(entry);await saveLive(s);(updates as any).recovery_entry_id=entry.entryId;const {data,error}=await db.from('mts_work_sessions').update(updates).eq('id',id).select('*').single();if(error)throw error;return {status:200,body:data};
  }
  m=path.match(/^\/api\/mts\/evidence\/([^/]+)$/);
  if(m&&method==='GET'){const id=decodeURIComponent(m[1]);const {data,error}=await db.from('mts_work_sessions').select('*').eq('id',id).single();if(error)throw error;if(!rowVisibleToCompany(data,actor))fail('This work session belongs to another company.',403);const s=await liveState(),entry=s.timeEntries.find((x:any)=>x.entryId===data.recovery_entry_id)||null;return {status:200,body:{mts_session:data,recovery_time_entry:entry,monthly_engine:null,recovery_passport:null,trace:['MTS work session','Draft/approved time entry','Supabase persistence','Recovery controls']}};}
  if(path==='/api/mts/import'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const rows=Array.isArray(body.records)?body.records:[];const out=[];for(const r of rows){const row={...r,id:clean(r.id)||uid('MTS'),company_id:companyIdFor(actor,r.company_id||r.companyId),created_at:r.created_at||now(),updated_at:now()};const {data,error}=await db.from('mts_work_sessions').upsert(row,{onConflict:'id'}).select('*').single();if(error)throw error;out.push(data);}return {status:201,body:out};}
  if(path==='/api/mts/messages'&&method==='GET'){let query=db.from('mts_messages').select('*').order('created_at',{ascending:false}).limit(Math.min(Number(q.limit||100),1000));if(actor.role!==ROLE_DEVELOPER)query=query.eq('company_id',companyIdFor(actor));const {data,error}=await query;if(error)throw error;let rows=data||[];if(actor.role===ROLE_EMPLOYEE){const ids=new Set([actor.id,actor.name,actor.email,'all','everyone','system'].filter(Boolean).map(lower));rows=rows.filter((x:any)=>ids.has(lower(x.recipient)));}else if(q.recipient)rows=rows.filter((x:any)=>x.recipient===q.recipient);return {status:200,body:rows};}
  if(path==='/api/mts/messages'&&method==='POST'){const row={id:uid('MSG'),company_id:companyIdFor(actor,body.company_id||body.companyId),recipient:clean(body.recipient),sender:actor.name||actor.id,content:clean(body.content),read:false,created_at:now()};if(!row.recipient||!row.content)fail('Recipient and message content are required.');const {data,error}=await db.from('mts_messages').insert(row).select('*').single();if(error)throw error;return {status:201,body:data};}
  m=path.match(/^\/api\/mts\/messages\/([^/]+)\/read$/);
  if(m&&method==='PATCH'){const id=decodeURIComponent(m[1]);const {data:existing,error:e0}=await db.from('mts_messages').select('*').eq('id',id).single();if(e0)throw e0;if(!rowVisibleToCompany(existing,actor))fail('This message belongs to another company.',403);const ids=new Set([actor.id,actor.name,actor.email,'all','everyone','system'].filter(Boolean).map(lower));if(actor.role===ROLE_EMPLOYEE&&!ids.has(lower(existing.recipient)))fail('This message belongs to another recipient.',403);const {data,error}=await db.from('mts_messages').update({read:true}).eq('id',id).select('*').single();if(error)throw error;return {status:200,body:data};}
  if(path==='/api/mts/overview'&&method==='GET'){let query=db.from('mts_work_sessions').select('*');if(actor.role!==ROLE_DEVELOPER)query=query.eq('company_id',companyIdFor(actor));const {data,error}=await query;if(error)throw error;let rows=data||[];if(q.month)rows=rows.filter((x:any)=>String(x.work_date||'').slice(0,7)===String(q.month).slice(0,7));const completed=rows.filter((x:any)=>x.status==='completed'),hours=completed.reduce((a:number,x:any)=>a+Number(x.duration_hours||0),0);return {status:200,body:{period:q.month||'all',total_sessions:rows.length,active_sessions:rows.filter((x:any)=>x.status==='active'||x.status==='rework_required').length,completed_sessions:completed.length,total_hours:hours,average_completion:completed.length?completed.reduce((a:number,x:any)=>a+Number(x.completion_percent||0),0)/completed.length:0,recovery_drafts:completed.filter((x:any)=>x.recovery_entry_id).length,unbridged:completed.filter((x:any)=>!x.recovery_entry_id).length,top_workers:[],employee_performance:[],department_performance:[],project_performance:[],daily_analytics:[],jobs_analytics:[],overtime:[],hours_by_project:[],hours_by_month:[]}};}

  if(path==='/api/memory'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);let query=db.from('agent_memories').select('*').order('updated_at',{ascending:false}).limit(Math.min(Number(q.limit||100),500));if(q.category)query=query.eq('category',q.category);if(q.authority)query=query.eq('authority',q.authority);const {data,error}=await query;if(error)throw error;return {status:200,body:filterCompanyRows(data||[],actor)};}
  if(path==='/api/memory/search'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const term=clean(q.q).replace(/[%_,]/g,'');const {data,error}=await db.from('agent_memories').select('*').or(`title.ilike.%${term}%,content.ilike.%${term}%`).order('importance',{ascending:false}).limit(Math.min(Number(q.limit||12)*4,200));if(error)throw error;return {status:200,body:filterCompanyRows(data||[],actor).slice(0,Math.min(Number(q.limit||12),50))};}
  if(path==='/api/memory'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const row={title:clean(body.title),content:clean(body.content),category:body.category||'fact',authority:body.authority||'CONFIRMED',importance:Number(body.importance??0.7),source_type:'user_ui',source_ref:clean(body.source_ref),tags:Array.isArray(body.tags)?body.tags:[],metadata:{...(body.metadata||{}),company_id:companyIdFor(actor)},session_id:clean(body.session_id),created_at:now(),updated_at:now()};const {data,error}=await db.from('agent_memories').insert(row).select('*').single();if(error)throw error;return {status:201,body:data};}
  m=path.match(/^\/api\/memory\/([^/]+)$/);if(m&&method==='DELETE'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const {error}=await db.from('agent_memories').delete().eq('id',decodeURIComponent(m[1]));if(error)throw error;return {status:200,body:{deleted:true}};}
  if(path==='/api/memory/overview'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const {count,error}=await db.from('agent_memories').select('*',{count:'exact',head:true});if(error)throw error;return {status:200,body:{total:count||0}};}

  if(path==='/api/records'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);let query=db.from('system_records').select('*').order('updated_at',{ascending:false}).limit(Math.min(Number(q.limit||100),500));if(q.record_type)query=query.eq('record_type',q.record_type);if(q.status)query=query.eq('status',q.status);const {data,error}=await query;if(error)throw error;return {status:200,body:filterCompanyRows(data||[],actor)};}
  if(path==='/api/records/search'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const term=clean(q.q).replace(/[%_,]/g,'');const {data,error}=await db.from('system_records').select('*').or(`title.ilike.%${term}%,content.ilike.%${term}%`).order('updated_at',{ascending:false}).limit(Math.min(Number(q.limit||12)*4,200));if(error)throw error;return {status:200,body:filterCompanyRows(data||[],actor).slice(0,Math.min(Number(q.limit||12),50))};}
  if(path==='/api/records'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const {data,error}=await db.from('system_records').insert({record_type:body.record_type||body.recordType||'note',title:clean(body.title),content:clean(body.content),status:body.status||'active',metadata:{...(body.metadata||{}),company_id:companyIdFor(actor)},source:'user_ui',session_id:clean(body.session_id),created_at:now(),updated_at:now()}).select('*').single();if(error)throw error;return {status:201,body:data};}
  m=path.match(/^\/api\/records\/([^/]+)\/status$/);if(m&&method==='PATCH'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const {data,error}=await db.from('system_records').update({status:clean(body.status)||'active',updated_at:now()}).eq('id',decodeURIComponent(m[1])).select('*').single();if(error)throw error;return {status:200,body:data};}
  if(path==='/api/actions'&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const {data,error}=await db.from('agent_action_log').select('*').order('created_at',{ascending:false}).limit(Math.min(Number(q.limit||100),500));if(error)throw error;return {status:200,body:data||[]};}
  if(path==='/api/learning'&&method==='GET'){const {data,error}=await db.from('agent_learning_mappings').select('*').eq('company_id',companyIdFor(actor)).order('last_confirmed_at',{ascending:false}).limit(Math.min(Number(q.limit||100),500));if(error)throw error;return {status:200,body:data||[]};}
  if(path==='/api/learning'&&method==='POST'){const activity=clean(body.activity||body.activity_example),project=clean(body.project_code||body.projectCode);if(!activity||!project)fail('Activity and project code are required.');const activity_key=lower(activity).replace(/\s+/g,' ').slice(0,220);const {data:existing}=await db.from('agent_learning_mappings').select('*').eq('company_id',companyIdFor(actor)).eq('activity_key',activity_key).eq('project_code',project).maybeSingle();let result;if(existing){const {data,error}=await db.from('agent_learning_mappings').update({accepted_count:Number(existing.accepted_count||0)+1,activity_example:activity,last_confirmed_at:now(),note:clean(body.note)}).eq('id',existing.id).select('*').single();if(error)throw error;result=data;}else{const {data,error}=await db.from('agent_learning_mappings').insert({company_id:companyIdFor(actor),activity_key,activity_example:activity,project_code:project,accepted_count:1,confirmed_by:actor.id,note:clean(body.note),created_at:now(),last_confirmed_at:now()}).select('*').single();if(error)throw error;result=data;}return {status:201,body:result};}

  if(path==='/api/brain/status'&&method==='GET'){const thread=await readState(`brain_thread:${actor.id}`,{messages:[]});return {status:200,body:{configured:Boolean(Deno.env.get('OPENAI_API_KEY')),runtime:'supabase-edge',model:Deno.env.get('OPENAI_MODEL')||'gpt-5.4',messages:(thread.messages||[]).length,actor_id:actor.id}};}
  if(path==='/api/brain/thread'&&method==='GET'){const thread=await readState(`brain_thread:${actor.id}`,{messages:[]});return {status:200,body:{messages:(thread.messages||[]).slice(-Math.min(Number(q.limit||150),300)),actor_id:actor.id}};}
  if(path==='/api/brain/chat'&&method==='POST'){const message=clean(body.message);if(!message)fail('Message is required.');return {status:200,body:await runRecoveryAgent(actor,message)};}
  if(path==='/api/brain/activity'&&method==='GET'){const runId=clean(q.run_id);if(!runId)fail('run_id is required.');const st=await readState(`agent_activity:${runId}`,{events:[]});const after=Number(q.after||0);return {status:200,body:{events:(st.events||[]).filter((x:any)=>Number(x.sequence||0)>after).slice(0,Math.min(Number(q.limit||100),200))}};}
  if(path==='/api/brain/predict'&&method==='POST'){const text=clean(body.text);if(text.length<8)return {status:200,body:{available:false,predictions:[]}};const endings=['and summarize the key risks.','and show me what needs attention first.','and compare this with the current project data.','and create a follow-up task if action is required.'];return {status:200,body:{available:true,predictions:endings.map((x,i)=>({text:x,probability:[.42,.28,.18,.12][i]}))}};}
  if(path==='/api/brain/scan'&&method==='POST'){const s=scopeLive(await liveState(),actor),detail=`Current Supabase state contains ${s.employees.length} employee(s), ${s.projects.length} project(s), and ${s.timeEntries.length} time entr${s.timeEntries.length===1?'y':'ies'}.`;const thread=await readState(`brain_thread:${actor.id}`,{messages:[]});const row={id:uid('MSG'),role:'assistant',content:detail,source:'proactive',created_at:now(),unread:true};thread.messages=[...(thread.messages||[]),row].slice(-300);await writeState(`brain_thread:${actor.id}`,thread);return {status:200,body:{message:row,scanned:true}};}
  if(path==='/api/brain/resume'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);return {status:200,body:{output_text:'There is no paused Edge agent action to resume. Controlled actions are stored as review items before execution.',requires_approval:false,approvals:[],approval_state:'',llm_configured:Boolean(Deno.env.get('OPENAI_API_KEY'))}};}
  m=path.match(/^\/api\/brain\/messages\/([^/]+)\/read$/);if(m&&method==='PATCH'){const id=decodeURIComponent(m[1]),thread=await readState(`brain_thread:${actor.id}`,{messages:[]}),row=(thread.messages||[]).find((x:any)=>x.id===id);if(row)row.unread=false;await writeState(`brain_thread:${actor.id}`,thread);return {status:200,body:row||{id,read:true}};}
  if(path==='/api/brain/thread'&&method==='DELETE'){await writeState(`brain_thread:${actor.id}`,{messages:[]});return {status:200,body:{cleared:true,actor_id:actor.id}};}

  m=path.match(/^\/api\/session\/([^/]+)$/);if(m&&method==='GET'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const id=decodeURIComponent(m[1]);const {data,error}=await db.from('agent_session_items').select('item,sequence').eq('session_id',id).order('sequence',{ascending:true}).limit(Math.min(Number(q.limit||100),500));if(error)throw error;return {status:200,body:{session_id:id,items:(data||[]).map((x:any)=>x.item)}};}if(m&&method==='DELETE'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);const id=decodeURIComponent(m[1]);const {error}=await db.from('agent_session_items').delete().eq('session_id',id);if(error)throw error;return {status:200,body:{cleared:true,session_id:id}};}

  if(path==='/api/agent'&&method==='POST'){const message=clean(body.message||body.input||body.prompt);if(!message)fail('Message is required.');return {status:200,body:await runRecoveryAgent(actor,message)};}
  if(path==='/api/agent/resume'&&method==='POST'){requireRole(actor,[ROLE_DEVELOPER,ROLE_ADMIN]);return {status:200,body:{output_text:'No paused Supabase Edge agent run is pending.',requires_approval:false}};}

  if(path==='/api/knowledge/overview'&&method==='GET'){const {count,error}=await db.from('agent_memories').select('*',{count:'exact',head:true});if(error)throw error;return {status:200,body:{items:count||0,source:'supabase'}};}
  if(path==='/api/knowledge/search'&&method==='GET'){const term=clean(q.q).replace(/[%_,]/g,'');const {data,error}=await db.from('agent_memories').select('*').or(`title.ilike.%${term}%,content.ilike.%${term}%`).order('importance',{ascending:false}).limit(Math.min(Number(q.limit||12)*4,200));if(error)throw error;return {status:200,body:filterCompanyRows(data||[],actor).slice(0,Math.min(Number(q.limit||12),50))};}

  // The browser contains the deterministic workbook engine. These endpoints provide
  // Supabase-backed inputs/status without recreating that math in a separate server.
  if(path==='/api/engine/overview'&&method==='GET'){const s=scopeLive(await liveState(),actor);return {status:200,body:{mode:'supabase-edge',records:s.timeEntries.length,employees:s.employees.length,projects:s.projects.length,payroll_rows:s.payroll.length,calendar_days:s.calendar.length}};}
  if(path==='/api/engine/time'&&method==='GET'){const s=scopeLive(await liveState(),actor);let rows=s.timeEntries;if(q.month)rows=rows.filter((x:any)=>x.month===monthKey(q.month));if(q.project)rows=rows.filter((x:any)=>x.projectCode===q.project);return {status:200,body:rows};}
  if(['/api/engine/dashboard','/api/engine/monthly','/api/engine/checks','/api/engine/calendar','/api/engine/formulas','/api/engine/voucher'].includes(path)&&method==='GET')return {status:200,body:[]};

  fail(`Edge API route not found: ${method} ${path}`,404);
}

Deno.serve(async (req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  try{
    const e:Envelope=req.method==='POST'?await req.json().catch(()=>({})):{};
    const result=await handle(req,e);
    return reply(req,result.body,result.status);
  }catch(error:any){
    console.error('Assurance Regent Edge API error',error?.message||error);
    return reply(req,{error:error?.message||'Unexpected Edge Function error.'},errStatus(error));
  }
});
