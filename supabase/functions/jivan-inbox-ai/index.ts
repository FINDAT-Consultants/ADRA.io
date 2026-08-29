// Assurance Regent v6.3.28 — dedicated operational AI Inbox engine.
// This function is intentionally separate from the ordinary Jivan chat thread.
// It only creates role-scoped operational advisories and replies inside an existing AI Inbox thread.
declare const Deno: any;

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const env=(name:string)=>String(Deno.env.get(name)||'').trim();
const base=()=>env('SUPABASE_URL').replace(/\/$/,'');
const serviceKey=()=>env('SUPABASE_SERVICE_ROLE_KEY');
const q=(v:any)=>encodeURIComponent(String(v??''));
const clean=(v:any,n=6000)=>String(v??'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,n);
const headers=(extra:Record<string,string>={})=>({apikey:serviceKey(),Authorization:`Bearer ${serviceKey()}`,...extra});

async function sf(path:string,init:any={}){
  const r=await fetch(base()+path,{...init,headers:{...headers(),...(init.headers||{})}});
  const text=await r.text();let body:any=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!r.ok){const e:any=new Error(body?.message||body?.error||String(body||`HTTP ${r.status}`));e.status=r.status;throw e;}
  return body;
}
const rpc=(name:string,payload:any={})=>sf(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});

function field(row:any,...keys:string[]){for(const k of keys)if(row&&row[k]!=null&&String(row[k]).trim())return String(row[k]).trim();return '';}
function num(row:any,...keys:string[]){for(const k of keys){const n=Number(row?.[k]);if(Number.isFinite(n))return n;}return 0;}
function normalized(values:any[]){return values.filter(Boolean).map(x=>String(x).trim().toLowerCase()).filter(Boolean);}
function companyMatch(row:any,companyId:string){return Boolean(companyId)&&field(row,'companyId','company_id')===companyId;}
function actorMatch(row:any,actor:any){
  const av=new Set(normalized([actor?.id,actor?.name,actor?.email,actor?.employeeId,actor?.employee_id]));
  const rv=normalized([field(row,'employeeId','employee_id','userId','user_id','actorId','actor_id','ownerId','owner_id','email'),field(row,'employee','employee_name','name','owner')]);
  return rv.some(x=>av.has(x));
}
function functionalAuthority(actor:any){
  const role=String(actor?.role||'Employee'),text=[actor?.supervisoryRole,actor?.supervisory_role,actor?.position,actor?.department].filter(Boolean).join(' ').toLowerCase();
  if(role==='Developer')return 'DEVELOPER';
  if(/\bchief executive officer\b|\bceo\b/.test(text))return 'CEO';
  if(/human resources|human resource|\bhr\b/.test(text)&&/(manager|director|head)/.test(text))return 'HR_MANAGER';
  if(/program(?:me)?s?/.test(text)&&/(manager|director|head)/.test(text))return 'PROGRAMS_MANAGER';
  if(/project/.test(text)&&/(manager|director|head)/.test(text))return 'PROJECT_MANAGER';
  const supervisor=String(actor?.supervisoryRole||actor?.supervisory_role||'');
  if(supervisor==='Head of Department')return 'HEAD_OF_DEPARTMENT';
  if(supervisor==='Supervisor')return 'SUPERVISOR';
  if(role==='Administrator')return 'ADMINISTRATOR';
  return 'EMPLOYEE';
}
function topicPolicy(authority:string){
  if(authority==='DEVELOPER')return ['EMPLOYEE_PERFORMANCE','LEAVE_ATTENTION','PROJECT_PERFORMANCE','PROGRAM_STRATEGY','PROJECT_SUGGESTION','WORKFORCE_RISK'];
  if(['CEO','ADMINISTRATOR'].includes(authority))return ['EMPLOYEE_PERFORMANCE','LEAVE_ATTENTION','PROJECT_PERFORMANCE','PROGRAM_STRATEGY','PROJECT_SUGGESTION','WORKFORCE_RISK'];
  if(authority==='HR_MANAGER')return ['EMPLOYEE_PERFORMANCE','LEAVE_ATTENTION','WORKFORCE_RISK'];
  if(authority==='PROGRAMS_MANAGER')return ['PROJECT_PERFORMANCE','PROGRAM_STRATEGY','PROJECT_SUGGESTION','TEAM_PERFORMANCE'];
  if(authority==='PROJECT_MANAGER')return ['PROJECT_PERFORMANCE','PROJECT_DELIVERY','TEAM_PERFORMANCE'];
  if(['HEAD_OF_DEPARTMENT','SUPERVISOR'].includes(authority))return ['TEAM_PERFORMANCE','LEAVE_ATTENTION','PROJECT_DELIVERY'];
  return ['PERSONAL_PERFORMANCE','PERSONAL_LEAVE'];
}
function compact(value:any,depth=0):any{
  if(value==null)return value;if(depth>5)return '[nested omitted]';
  if(Array.isArray(value))return value.slice(0,120).map(x=>compact(x,depth+1));
  if(typeof value!=='object')return typeof value==='string'?value.slice(0,900):value;
  const out:any={};for(const [k,v] of Object.entries(value)){if(/password|token|secret|apikey|api_key|profilephoto|profile_photo|document_data|bank/i.test(k))continue;out[k]=compact(v,depth+1);}return out;
}
function elapsedHours(row:any){
  const direct=num(row,'hours','durationHours','duration_hours','totalHours','total_hours');if(direct>0)return direct;
  const a=Date.parse(field(row,'clockInAt','clock_in_at','startAt','start_at','startedAt','started_at')),b=Date.parse(field(row,'clockOutAt','clock_out_at','endAt','end_at','endedAt','ended_at'));
  return Number.isFinite(a)&&Number.isFinite(b)&&b>a?(b-a)/3600000:0;
}
function completionPct(row:any){
  const p=num(row,'completion','completionPct','completion_pct','progress','progressPct','progress_pct');if(p>0)return Math.min(100,p);
  const done=num(row,'completedTasks','completed_tasks','tasksDone','tasks_done'),total=num(row,'totalTasks','total_tasks','taskCount','task_count');return total>0?Math.min(100,done/total*100):0;
}
function projectKey(row:any){return field(row,'projectCode','project_code','project','projectName','project_name','projectId','project_id')||'Unassigned';}
function employeeKey(row:any){return field(row,'employeeId','employee_id','userId','user_id','employee','employee_name','name')||'Unknown';}

function buildScope(actor:any,state:any){
  const authority=functionalAuthority(actor),developer=authority==='DEVELOPER',companyId=String(actor?.companyId||'').trim(),dept=String(actor?.department||'').trim().toLowerCase();
  const live=state?.live||{},mts=state?.mts||{},leave=state?.leaveModule||{};
  const companyRows=(rows:any)=>{const a=Array.isArray(rows)?rows:[];return (developer?a:a.filter((r:any)=>companyMatch(r,companyId))).slice(0,300);};
  const employees=companyRows(live.employees),actorRefs=new Set(normalized([actor?.id,actor?.name,actor?.email,actor?.employeeId,actor?.employee_id]));
  const managedEmployees=employees.filter((e:any)=>{
    if(developer||['CEO','ADMINISTRATOR','HR_MANAGER','PROGRAMS_MANAGER'].includes(authority))return true;
    if(authority==='EMPLOYEE')return actorMatch(e,actor);
    const sameDept=Boolean(dept)&&field(e,'department').toLowerCase()===dept;
    const supervisor=field(e,'supervisor','supervisorId','supervisor_id').toLowerCase();
    return actorMatch(e,actor)||sameDept||actorRefs.has(supervisor);
  });
  const managedIds=new Set(managedEmployees.flatMap((e:any)=>normalized([field(e,'id','employeeId','employee_id'),field(e,'name'),field(e,'email')])));
  const managed=(rows:any)=>companyRows(rows).filter((r:any)=>{
    if(developer||['CEO','ADMINISTRATOR','HR_MANAGER','PROGRAMS_MANAGER'].includes(authority))return true;
    if(authority==='EMPLOYEE')return actorMatch(r,actor);
    const vals=normalized([employeeKey(r),field(r,'employee','employee_name','name')]);return actorMatch(r,actor)||vals.some(x=>managedIds.has(x));
  });
  const sessions=managed(mts.sessions||[]).slice(0,220);
  const leaveRows=managed(leave.requests||[]).slice(0,160);
  let projects=companyRows(live.projects||[]);
  if(authority==='EMPLOYEE')projects=projects.filter((p:any)=>actorMatch(p,actor)||managedIds.has(field(p,'eligibleEmployeeId','employeeId','employee_id').toLowerCase()));
  else if(['PROJECT_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR'].includes(authority))projects=projects.filter((p:any)=>{
    const pdept=field(p,'department','team').toLowerCase(),manager=field(p,'managerId','manager_id','manager','projectManager','project_manager').toLowerCase();return !dept||pdept===dept||actorRefs.has(manager)||managedIds.has(field(p,'eligibleEmployeeId','employeeId','employee_id').toLowerCase());
  });
  projects=projects.slice(0,140);

  const workerAgg=new Map<string,any>(),projectAgg=new Map<string,any>();
  for(const s of sessions){
    const ek=employeeKey(s),pk=projectKey(s),hours=elapsedHours(s),completion=completionPct(s);
    const w=workerAgg.get(ek)||{employee:field(s,'employee_name','employee','name')||ek,sessions:0,hours:0,completionTotal:0,completionSamples:0,overtimeDays:0};w.sessions++;w.hours+=hours;if(completion>0){w.completionTotal+=completion;w.completionSamples++;}if(hours>8)w.overtimeDays++;workerAgg.set(ek,w);
    const p=projectAgg.get(pk)||{project:pk,sessions:0,hours:0,completionTotal:0,completionSamples:0};p.sessions++;p.hours+=hours;if(completion>0){p.completionTotal+=completion;p.completionSamples++;}projectAgg.set(pk,p);
  }
  const workers=[...workerAgg.values()].map(w=>({...w,hours:Number(w.hours.toFixed(2)),averageCompletion:w.completionSamples?Number((w.completionTotal/w.completionSamples).toFixed(1)):null})).sort((a,b)=>(b.averageCompletion||0)-(a.averageCompletion||0)||b.hours-a.hours).slice(0,40);
  const projectPerformance=[...projectAgg.values()].map(p=>({...p,hours:Number(p.hours.toFixed(2)),averageCompletion:p.completionSamples?Number((p.completionTotal/p.completionSamples).toFixed(1)):null})).sort((a,b)=>(b.averageCompletion||0)-(a.averageCompletion||0)||b.hours-a.hours).slice(0,40);
  const pendingLeave=leaveRows.filter((x:any)=>String(field(x,'status')).toUpperCase()==='PENDING').map((x:any)=>({id:field(x,'id'),employee:field(x,'employee_name','employee','employeeId','employee_id'),type:field(x,'leave_type','leaveType','type'),start:field(x,'start_date','startDate'),end:field(x,'end_date','endDate'),requestedDays:num(x,'requested_days','requestedDays')})).slice(0,40);
  const projectSummary=projects.map((p:any)=>({code:field(p,'code','projectCode','project_code','id'),name:field(p,'name','title','projectName','project_name'),status:field(p,'status'),department:field(p,'department','team'),manager:field(p,'manager','projectManager','project_manager'),startDate:field(p,'startDate','start_date'),endDate:field(p,'endDate','end_date'),progress:num(p,'progress','progressPct','progress_pct')}));
  const employeeSummary=managedEmployees.slice(0,120).map((e:any)=>({id:field(e,'id','employeeId','employee_id'),name:field(e,'name'),position:field(e,'position'),department:field(e,'department'),status:field(e,'status')}));
  return {authority,companyId,department:actor?.department||'',allowedTopics:topicPolicy(authority),metrics:{workers,projectPerformance,pendingLeave,projectPortfolio:projectSummary,employees:employeeSummary,sessionCount:sessions.length,projectCount:projects.length},samples:{recentSessions:sessions.slice(-60).map((x:any)=>compact(x)),leaveRequests:leaveRows.slice(-40).map((x:any)=>compact(x))}};
}

async function hashText(value:string){const bytes=new TextEncoder().encode(value),digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));return [...digest].map(x=>x.toString(16).padStart(2,'0')).join('');}
function outputText(response:any){if(typeof response?.output_text==='string'&&response.output_text.trim())return response.output_text.trim();const out:string[]=[];for(const item of response?.output||[])for(const c of item?.content||[])if((c?.type==='output_text'||c?.type==='text')&&typeof c?.text==='string')out.push(c.text);return out.join('\n').trim();}
function parseJsonText(text:string){let s=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(s);}catch{return null;}}
async function openaiJson(instructions:string,input:any,maxTokens=1800){
  const apiKey=env('OPENAI_API_KEY'),model=env('OPENAI_MODEL')||'gpt-5.1';if(!apiKey)throw new Error('OPENAI_API_KEY is not configured for operational Inbox advisories.');
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,instructions,input:JSON.stringify(input),store:false,max_output_tokens:maxTokens})});
  const text=await r.text();let body:any=null;try{body=text?JSON.parse(text):null;}catch{body={error:{message:text}};}if(!r.ok)throw new Error(body?.error?.message||`OpenAI advisory generation failed (${r.status}).`);const parsed=parseJsonText(outputText(body));if(!parsed)throw new Error('Operational advisory generation returned invalid structured output.');return parsed;
}
async function insertMessage(row:any){return sf('/rest/v1/mts_messages',{method:'POST',headers:{'content-type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});}

async function generateAdvisories(token:string,actor:any,state:any,force=false){
  const actorId=clean(actor?.id,160),scope=buildScope(actor,state),now=new Date();
  if(!force){const since=new Date(Date.now()-10*60*1000).toISOString();const recent=await sf(`/rest/v1/mts_messages?recipient_id=eq.${q(actorId)}&kind=eq.AI_ADVISORY&created_at=gte.${q(since)}&select=id&limit=1`,{headers:{accept:'application/json'}});if(Array.isArray(recent)&&recent.length)return {generated:0,skipped:'cooldown'};}
  const instructions=`You are Jivan's dedicated OPERATIONAL INBOX advisory engine inside Assurance Regent. You are NOT the ordinary Jivan chatbox and you must never copy casual chat, greetings, ordinary Q&A, or general conversation into the Inbox. Produce only meaningful operational intelligence that deserves a persistent Inbox thread for the signed-in user's role.\n\nReturn JSON only in this exact shape: {"advisories":[{"topic":"...","scope_key":"...","title":"...","priority":"LOW|MEDIUM|HIGH","content":"..."}]}. Generate 0 to 4 advisories. The topic must be one of the ALLOWED TOPICS supplied in the input. Keep each title under 90 characters and each content under 900 characters.\n\nGround every factual statement in supplied Assurance Regent data. Never invent attendance, completion rates, leave facts, projects, budgets, beneficiaries, deadlines or performance claims. If evidence is insufficient, return fewer advisories or none. Recommendations must be clearly framed as recommendations. For PROJECT_SUGGESTION, propose only a concept to consider based on an observed portfolio/delivery gap; never pretend a new project already exists and never invent a budget. Focus on what the recipient should notice, why it matters, and a practical next step. Do not expose information outside the role/company scope supplied.`;
  const result=await openaiJson(instructions,{signedInUser:{id:actorId,name:actor?.name||'',position:actor?.position||'',department:actor?.department||'',authority:scope.authority},allowedTopics:scope.allowedTopics,operationalScope:scope});
  const advisories=Array.isArray(result?.advisories)?result.advisories.slice(0,4):[],created:any[]=[];
  for(const raw of advisories){
    const topic=clean(raw?.topic,80).toUpperCase();if(!scope.allowedTopics.includes(topic))continue;const title=clean(raw?.title,90),content=clean(raw?.content,900),priority=['LOW','MEDIUM','HIGH'].includes(String(raw?.priority||'').toUpperCase())?String(raw.priority).toUpperCase():'MEDIUM',scopeKey=clean(raw?.scope_key,100)||'GENERAL';if(!title||!content)continue;
    const day=now.toISOString().slice(0,10),threadHash=(await hashText(`${actorId}|${topic}|${scopeKey}`)).slice(0,32),advisoryHash=(await hashText(`${actorId}|${topic}|${scopeKey}|${title}|${day}`)).slice(0,40),threadId=`AI-${threadHash}`,advisoryKey=`ADV-${advisoryHash}`;
    const existing=await sf(`/rest/v1/mts_messages?recipient_id=eq.${q(actorId)}&advisory_key=eq.${q(advisoryKey)}&select=id&limit=1`,{headers:{accept:'application/json'}});if(Array.isArray(existing)&&existing.length)continue;
    const id='MSG-'+crypto.randomUUID().replace(/-/g,''),company=clean(actor?.companyId,160)||'GLOBAL';
    try{await insertMessage({id,company_id:company,recipient:clean(actor?.name||actorId,220),sender:'Jivan',content,read:false,created_at:now.toISOString(),sender_id:'JIVAN',recipient_id:actorId,sender_name:'Jivan',recipient_name:clean(actor?.name||actorId,220),kind:'AI_ADVISORY',attachment_name:'',attachment_type:'',attachment_size:0,thread_id:threadId,thread_title:title,topic,advisory_key:advisoryKey,hidden_for_sender:false,hidden_for_recipient:false,metadata:{channel:'INTERNAL_INBOX',source:'AI_OPERATIONAL_ADVISORY',priority,scopeKey,authority:scope.authority,generatedAt:now.toISOString()}});created.push({id,threadId,topic,title,priority});}catch(e:any){if(Number(e?.status)!==409)throw e;}
  }
  return {generated:created.length,advisories:created};
}

async function replyInThread(token:string,actor:any,state:any,threadId:string,message:string){
  const thread=await rpc('assurance_regent_browser_message_thread',{p_token:token,p_thread_id:threadId});if(!thread?.isAi)throw new Error('This is not an operational AI Inbox conversation.');const history=Array.isArray(thread?.messages)?thread.messages:[];
  const root=history.find((m:any)=>m?.kind==='AI_ADVISORY'||m?.metadata?.source==='AI_OPERATIONAL_ADVISORY');if(!root)throw new Error('This AI conversation does not have an operational advisory origin.');
  const actorId=clean(actor?.id,160),company=clean(root?.companyId||actor?.companyId,160)||'GLOBAL',now=new Date().toISOString(),userId='MSG-'+crypto.randomUUID().replace(/-/g,'');
  await insertMessage({id:userId,company_id:company,recipient:'Jivan',sender:clean(actor?.name||actorId,220),content:message,read:true,read_at:now,created_at:now,sender_id:actorId,recipient_id:'JIVAN',sender_name:clean(actor?.name||actorId,220),recipient_name:'Jivan',kind:'AI_USER',attachment_name:'',attachment_type:'',attachment_size:0,thread_id:threadId,thread_title:clean(thread?.title||root?.threadTitle||'Operational advisory',180),topic:clean(thread?.topic||root?.topic,80),advisory_key:'',hidden_for_sender:false,hidden_for_recipient:false,metadata:{channel:'INTERNAL_INBOX',source:'AI_INBOX_THREAD'}});
  const scope=buildScope(actor,state),conversation=[...history,{senderId:actorId,senderName:actor?.name||actorId,content:message}].slice(-24).map((m:any)=>({speaker:String(m?.senderId||'').toUpperCase()==='JIVAN'?'Jivan':'User',content:clean(m?.content,1600)}));
  const instructions=`You are Jivan continuing one existing Assurance Regent OPERATIONAL INBOX advisory thread. This is not the ordinary Jivan chatbox and you have no access to that chat history. Answer only in the context of the operational advisory, the user's follow-up, and the current role-scoped Assurance Regent data supplied here. Be conversational but operational: explain the evidence, implications, options and practical next steps. Do not invent facts. Do not expose another tenant or records outside the supplied scope. Do not claim you performed an action. If the user asks for a system change or approval, advise what should be done and which authorized person/control should perform it. Return JSON only: {"reply":"..."}, with reply under 1800 characters.`;
  const result=await openaiJson(instructions,{thread:{title:thread?.title||'',topic:thread?.topic||'',conversation},signedInUser:{id:actorId,name:actor?.name||'',position:actor?.position||'',department:actor?.department||'',authority:scope.authority},operationalScope:scope},1200);const reply=clean(result?.reply,1800);if(!reply)throw new Error('Jivan did not return an operational Inbox reply.');
  const replyId='MSG-'+crypto.randomUUID().replace(/-/g,''),replyAt=new Date().toISOString();
  await insertMessage({id:replyId,company_id:company,recipient:clean(actor?.name||actorId,220),sender:'Jivan',content:reply,read:true,read_at:replyAt,created_at:replyAt,sender_id:'JIVAN',recipient_id:actorId,sender_name:'Jivan',recipient_name:clean(actor?.name||actorId,220),kind:'AI_REPLY',attachment_name:'',attachment_type:'',attachment_size:0,thread_id:threadId,thread_title:clean(thread?.title||root?.threadTitle||'Operational advisory',180),topic:clean(thread?.topic||root?.topic,80),advisory_key:'',hidden_for_sender:false,hidden_for_recipient:false,metadata:{channel:'INTERNAL_INBOX',source:'AI_INBOX_THREAD',replyTo:userId}});
  return {ok:true,threadId,userMessageId:userId,replyMessageId:replyId,reply};
}

Deno.serve(async(req:any)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return json({error:'POST is required.'},405);
  try{
    if(!base()||!serviceKey())throw new Error('Supabase server environment is unavailable.');
    const body=await req.json().catch(()=>({})),token=clean(body?.session_token,260),mode=clean(body?.mode||'advisories',50).toLowerCase();if(!token)return json({error:'Assurance Regent session is required.'},401);
    const envelope=await rpc('assurance_regent_browser_agent_context',{p_token:token}),actor=envelope?.actor||null;if(!actor?.id)return json({error:'The signed-in Assurance Regent user could not be verified.'},401);const state=envelope?.state||{};
    if(mode==='advisories'){const out=await generateAdvisories(token,actor,state,body?.force===true);return json({ok:true,...out});}
    if(mode==='reply'){const threadId=clean(body?.thread_id,180),message=clean(body?.message,6000);if(!threadId||!message)return json({error:'Conversation and message are required.'},400);return json(await replyInThread(token,actor,state,threadId,message));}
    return json({error:'Unknown operational Inbox AI action.'},400);
  }catch(e:any){const message=String(e?.message||e||'Operational Inbox AI request failed.');return json({error:message},/session|signed-in/i.test(message)?401:400);}
});
