import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine, formulaCatalog } from './src/engine-runtime.js';
import { getLiveState, upsertLiveEmployee, upsertLiveProject, upsertLivePayroll, upsertLiveCalendar, addLiveTimeEntry, upsertLiveVacancy, upsertLiveCandidate, upsertLiveOnboarding, assignLiveContextCompany } from './src/live-data-store.js';
import { runAgentWorkflow, resumeAgentWorkflow } from './src/agents.js';
import { listMappings, recordMapping } from './src/learning-store.js';
import { getKnowledgeOverview, searchKnowledge } from './src/knowledge-base.js';
import { listMemories, searchMemories, saveMemory, deleteMemory, memoryOverview } from './src/memory-store.js';
import { listRecords, searchRecords, saveRecord, updateRecordStatus, listActions } from './src/record-store.js';
import { PersistentSession } from './src/persistent-session.js';
import { listMtsSessions, getMtsSession, getMtsOverview, computeMtsAnalytics, clockInMtsSession, clockOutMtsSession, markMtsSessionDocumentRework, importLegacyMtsRecords, listMtsMessages, createMtsMessage, markMtsMessageRead, getUnifiedEvidenceTrace } from './src/mts-store.js';
import { getControlCenter, getControlProfile, getControlUserScope, loginControlUser, registerControlUser, logoutControlUser, updateControlProfile, updateControlSettings, createCompany, createCompanyWithExecutive, assignControlRole, createControlUserByDeveloper, deleteControlUser, ingestControlDocument, getControlDocumentContent, reviewControlDocument, listControlReviews, actOnControlReview, saveAgentApprovalReview, resolveStoredControlReview } from './src/control-center-store.js';
import { initializeIntelligence, trainIntelligenceModels, getIntelligenceStatus, getLiveIntelligenceInsights, predictProjectCoding } from './src/intelligence-engine.js';
import { chatWithSystemBrain, resumeSystemBrain, predictSystemBrainContinuation, getSystemBrainThread, readSystemBrainMessage, clearSystemBrain, systemBrainStatus, unreadSystemBrainMessages, scanSystemBrain, scheduleSystemBrainScan, startSystemBrainMonitor } from './src/system-brain.js';
import { listAgentActivity } from './src/agent-activity-store.js';
import { requireSupabaseConfig } from './src/supabase.js';
import { issueAuthSession, getAuthSession, revokeAuthSession, AUTH_SESSION_TTL_MS } from './src/auth-session-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const brainChanged=(reason)=>scheduleSystemBrainScan({reason,delay:700});
const AUTH_COOKIE='assurance_regent_session';
const cookieToken=(req)=>{const raw=String(req.headers.cookie||'');for(const part of raw.split(';')){const i=part.indexOf('=');if(i<0)continue;const key=part.slice(0,i).trim();if(key===AUTH_COOKIE){try{return decodeURIComponent(part.slice(i+1).trim());}catch{return part.slice(i+1).trim();}}}return '';};
const requestToken=(req)=>{const header=String(req.headers.authorization||'');return header.startsWith('Bearer ')?header.slice(7).trim():cookieToken(req);};
const setAuthCookie=(res,token)=>res.cookie(AUTH_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:AUTH_SESSION_TTL_MS,path:'/'});
const clearAuthCookie=(res)=>res.clearCookie(AUTH_COOKIE,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'});
const currentActor=async(req)=>{const actorId=String(req?.authUserId||'');if(!actorId)return null;const p=await getControlProfile(actorId);return p.currentUser||null;};
const requireActor=async(req)=>{const a=await currentActor(req);if(!a)throw Object.assign(new Error('Sign in is required.'),{statusCode:401});return a;};
const requirePrivileged=async(req)=>{const a=await requireActor(req);if(!['Developer','Administrator'].includes(a.role))throw Object.assign(new Error('Administrator permission is required.'),{statusCode:403});return a;};
const requireDeveloper=async(req)=>{const a=await requireActor(req);if(a.role!=='Developer')throw Object.assign(new Error('Developer permission is required.'),{statusCode:403});return a;};
const rowCompany=(row)=>String(row?.companyId||row?.company_id||'COMPANY-DEFAULT');
const liveStateForActor=(live,actor)=>{if(actor?.role==='Developer')return live;const same=(row)=>rowCompany(row)===String(actor?.companyId||'COMPANY-DEFAULT'),own=(row)=>String(row?.employeeId||row?.employee_id||'')===String(actor?.id||'');if(actor?.role==='Administrator')return Object.fromEntries(Object.entries(live).map(([key,rows])=>[key,(rows||[]).filter(same)]));return {...live,employees:(live.employees||[]).filter(own),projects:(live.projects||[]).filter(same),payroll:[],calendar:(live.calendar||[]).filter(same),timeEntries:(live.timeEntries||[]).filter(own),sources:[],sourceChecks:[],vacancies:[],candidates:[],onboarding:(live.onboarding||[]).filter(own)};};

app.get('/api/health', async (_req, res) => res.json({
  ok: true,
  engine: 'ADRA Recovery Assurance workbook engine',
  records: engine.state.timeEntries.length,
  agent_sdk: Boolean(process.env.OPENAI_API_KEY),
  intelligence: getIntelligenceStatus(),
  memory: await memoryOverview(),
  knowledge: await getKnowledgeOverview(),
  brain: { proactive_advice: Boolean(process.env.OPENAI_API_KEY), conversational_reasoning: true, causal_reasoning: true, deterministic_math: true, probabilistic_reasoning: true, predictive_compose: Boolean(process.env.OPENAI_API_KEY), task_execution: true, visible_ui_activity: true, adaptive_interaction_learning: true, openai_configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-5.6' }
}));

// All operational API calls are bound to a server-issued HttpOnly cookie (Bearer is retained only for API compatibility).
// The session registry itself is stored in Supabase using SHA-256 token hashes.
app.use('/api',async(req,res,next)=>{
  if(req.path==='/health'||req.path==='/control-center/login'||req.path==='/control-center/register')return next();
  try{
    const token=requestToken(req),session=await getAuthSession(token);
    if(!session){clearAuthCookie(res);return res.status(401).json({error:'Authentication required.'});}
    req.authUserId=session.userId;req.authToken=token;next();
  }catch(error){next(error);}
});


// Adaptive intelligence layer — server-only ML/deep-learning models. Predictions are advisory and never replace financial controls.
app.get('/api/intelligence/status', (_req,res)=>res.json(getIntelligenceStatus()));
app.get('/api/intelligence/insights', async (req,res,next)=>{try{await requirePrivileged(req);res.json(getLiveIntelligenceInsights());}catch(e){next(e);}});
app.get('/api/intelligence/project-coding', (req,res)=>res.json({activity:String(req.query.activity||req.query.q||''),predictions:predictProjectCoding(String(req.query.activity||req.query.q||''),{limit:Number(req.query.limit||5)})}));
app.post('/api/intelligence/train', async (req,res,next)=>{try{
  const actor=await requirePrivileged(req);
  if(!actor || !(actor.role==='Administrator'||actor.role==='Developer'||actor.canManageSettings))return res.status(403).json({error:'Administrator or Settings permission is required to retrain intelligence models.'});
  res.json(await trainIntelligenceModels({reason:String(req.body?.reason||'manual-settings-refresh')}));
}catch(e){next(e);}});

app.get('/api/engine/overview', async (req,res,next)=>{try{await requirePrivileged(req);res.json({mode:'live',records:engine.state.timeEntries.length,employees:engine.state.employees.length,projects:engine.state.projects.length,payroll_rows:engine.state.payroll.length,calendar_days:engine.state.calendar.length,formulas:formulaCatalog.length});}catch(e){next(e);}});
app.get('/api/engine/dashboard', async (req,res,next)=>{try{await requirePrivileged(req);res.json(engine.dashboard());}catch(e){next(e);}});
app.get('/api/engine/monthly', async (req, res, next) => { try{ await requirePrivileged(req); const month = String(req.query.month || ''); const rows = engine.monthlyEngine(); res.json(month ? rows.find(x => x.month === (month.length === 7 ? `${month}-01` : month)) || null : rows); }catch(e){next(e);} });
app.get('/api/engine/checks', async (req,res,next)=>{try{await requirePrivileged(req);res.json(engine.checks());}catch(e){next(e);}});
app.get('/api/engine/calendar', async (req,res,next)=>{try{await requirePrivileged(req);const month=String(req.query.month||''),key=month?(month.length===7?`${month}-01`:month):'';res.json(engine.calendarAnalysis().filter(x=>!key||x.month===key));}catch(e){next(e);}});
app.get('/api/engine/time', async (req,res,next)=>{try{const actor=await requireActor(req),month=String(req.query.month||''),project=String(req.query.project||''),key=month?(month.length===7?`${month}-01`:month):'';let rows=engine.analyzedTimeEntries();if(actor.role==='Employee')rows=rows.filter(x=>String(x.employeeId||x.employee_id||'')===String(actor.id));if(key)rows=rows.filter(x=>x.month===key);if(project)rows=rows.filter(x=>x.projectCode===project);res.json(rows);}catch(e){next(e);}});
app.get('/api/engine/formulas', async (req,res,next)=>{try{await requirePrivileged(req);res.json(formulaCatalog);}catch(e){next(e);}});
app.get('/api/engine/voucher', async (req,res,next)=>{try{await requirePrivileged(req); const month=String(req.query.month||''); const project=String(req.query.project||''); const value=engine.recoveryPassport(month,project); if(!value)return res.status(404).json({error:'No voucher found for that month/project'}); res.json(value); }catch(e){next(e);} });


// Live operational state. Historical prototype data is backend-only training/reference material and is never returned here.
app.get('/api/live/state', async (req,res,next)=>{try{const actor=await requireActor(req);res.json(liveStateForActor(getLiveState(),actor));}catch(e){next(e);}});
app.post('/api/live/employees', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveEmployee(body);brainChanged('employee-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/projects', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveProject(body);brainChanged('project-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/payroll', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLivePayroll(body);brainChanged('payroll-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/calendar', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveCalendar(body);brainChanged('calendar-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/time', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await addLiveTimeEntry(body);brainChanged('time-evidence-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/vacancies', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveVacancy(body);brainChanged('vacancy-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/candidates', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveCandidate(body);brainChanged('candidate-live-data-change');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/live/onboarding', async (req,res,next)=>{try{const actor=await requirePrivileged(req),body={...(req.body||{}),companyId:actor.role==='Developer'?String(req.body?.companyId||req.body?.company_id||'COMPANY-DEFAULT'):actor.companyId};const row=await upsertLiveOnboarding(body);brainChanged('onboarding-live-data-change');res.status(201).json(row);}catch(e){next(e);}});

app.get('/api/knowledge/overview', async (_req,res,next)=>{try{res.json(await getKnowledgeOverview());}catch(e){next(e);}});
app.get('/api/knowledge/search', async (req,res,next)=>{try{res.json(await searchKnowledge(String(req.query.q||''),{limit:Number(req.query.limit||12)}));}catch(e){next(e);}});

app.get('/api/memory', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await listMemories({limit:Number(req.query.limit||100),category:req.query.category?String(req.query.category):undefined,authority:req.query.authority?String(req.query.authority):undefined}));}catch(e){next(e);}});
app.get('/api/memory/search', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await searchMemories(String(req.query.q||''),{limit:Number(req.query.limit||12)}));}catch(e){next(e);}});
app.post('/api/memory', async (req,res,next)=>{try{await requirePrivileged(req);const body=req.body||{};res.status(201).json(await saveMemory({title:body.title,content:body.content,category:body.category||'fact',authority:body.authority||'CONFIRMED',importance:Number(body.importance??0.7),sourceType:'user_ui',sourceRef:body.source_ref||'',tags:Array.isArray(body.tags)?body.tags:[],metadata:body.metadata||{},sessionId:String(body.session_id||'')}));}catch(e){next(e);}});
app.delete('/api/memory/:id', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await deleteMemory(req.params.id));}catch(e){next(e);}});
app.get('/api/memory/overview', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await memoryOverview());}catch(e){next(e);}});

app.get('/api/records', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await listRecords({limit:Number(req.query.limit||100),recordType:req.query.record_type?String(req.query.record_type):undefined,status:req.query.status?String(req.query.status):undefined}));}catch(e){next(e);}});
app.get('/api/records/search', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await searchRecords(String(req.query.q||''),{limit:Number(req.query.limit||12)}));}catch(e){next(e);}});
app.post('/api/records', async (req,res,next)=>{try{await requirePrivileged(req);const b=req.body||{},row=await saveRecord({recordType:b.record_type||'note',title:b.title,content:b.content,status:b.status||'active',metadata:b.metadata||{},source:'user_ui',sessionId:String(b.session_id||'')});brainChanged('stored-record-change');res.status(201).json(row);}catch(e){next(e);}});
app.patch('/api/records/:id/status', async (req,res,next)=>{try{await requirePrivileged(req);const row=await updateRecordStatus(req.params.id,String(req.body?.status||'active'));brainChanged('task-or-record-status-change');res.json(row);}catch(e){next(e);}});
app.get('/api/actions', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await listActions(Number(req.query.limit||50)));}catch(e){next(e);}});

app.get('/api/learning', async (req,res,next)=>{try{await requirePrivileged(req);res.json(await listMappings());}catch(e){next(e);}});
app.post('/api/learning', async (req,res,next)=>{try{await requirePrivileged(req);const {activity,project_code,human_confirmed,note}=req.body||{}; if(human_confirmed!==true)return res.status(400).json({error:'A human-confirmed decision is required.'}); if(!engine.state.projects.some(p=>p.code===project_code))return res.status(400).json({error:'Unknown project code.'}); res.status(201).json(await recordMapping({activity,projectCode:project_code,confirmedBy:'human',note:note||''}));}catch(e){next(e);}});



// Master Time Schedule / unified work-evidence spine
async function mtsRowsForActor(actor,rows){if(actor?.role==='Developer')return rows;if(actor?.role==='Employee')return rows.filter(x=>String(x.employee_id)===String(actor.id));const scope=await getControlUserScope(actor.companyId),companyEmployeeIds=new Set(scope.companyUserIds.map(String)),allUserIds=new Set(scope.allUserIds.map(String));return rows.filter(x=>companyEmployeeIds.has(String(x.employee_id))||(actor.companyId==='COMPANY-DEFAULT'&&!allUserIds.has(String(x.employee_id))));}
app.get('/api/mts/overview', async (req,res,next)=>{try{const actor=await requireActor(req),month=req.query.month?String(req.query.month):undefined,sessions=await mtsRowsForActor(actor,await listMtsSessions({limit:5000}));res.json(computeMtsAnalytics(sessions,{month}));}catch(e){next(e);}});
app.get('/api/mts/sessions', async (req,res,next)=>{try{const actor=await requireActor(req);let rows=await listMtsSessions({limit:Number(req.query.limit||1000),status:req.query.status?String(req.query.status):undefined,projectCode:req.query.project?String(req.query.project):undefined,employeeName:req.query.employee?String(req.query.employee):undefined,month:req.query.month?String(req.query.month):undefined,query:req.query.q?String(req.query.q):undefined});rows=await mtsRowsForActor(actor,rows);res.json(rows);}catch(e){next(e);}});
app.get('/api/mts/evidence/:id', async (req,res,next)=>{try{const actor=await requireActor(req),value=await getUnifiedEvidenceTrace({mtsSessionId:req.params.id});if(!value)return res.status(404).json({error:'MTS session not found.'});const visible=await mtsRowsForActor(actor,[value.mts_session]);if(!visible.length)return res.status(403).json({error:'This work-evidence record is outside your company or employee scope.'});res.json(value);}catch(e){next(e);}});
app.post('/api/mts/clock-in', async (req,res,next)=>{try{const actor=await requireActor(req),b=req.body||{};if(actor.role==='Employee'&&String(b.employee_id)!==String(actor.id))return res.status(403).json({error:'Employees may clock in only for their own account.'});const row=await clockInMtsSession({employeeId:b.employee_id,employeeName:b.employee_name,department:b.department,projectCode:b.project_code,activityDescription:b.activity_description,clockInAt:b.clock_in_at,location:b.location||{},document:b.document||{},sessionId:String(b.session_id||'')});await assignLiveContextCompany({employeeId:row.employee_id,projectCode:row.project_code,date:row.work_date,companyId:actor.companyId||'COMPANY-DEFAULT'});if(b.document?.name){await ingestControlDocument({name:b.document.name,type:b.document.type,size:b.document.size,data:b.document.data,storagePath:row.document_path||'',source:'Work Activity Hub',sourceRef:row.id,department:b.department,projectCode:b.project_code,employeeId:b.employee_id,employeeName:b.employee_name,uploadedBy:b.employee_name||'Work Activity Hub',actorId:actor.id});}brainChanged('work-session-clock-in');res.status(201).json(row);}catch(e){next(e);}});
app.post('/api/mts/sessions/:id/clock-out', async (req,res,next)=>{try{const actor=await requireActor(req),b=req.body||{},existing=await getMtsSession(req.params.id);if(actor.role==='Employee'&&existing&&String(existing.employee_id)!==String(actor.id))return res.status(403).json({error:'Employees may clock out only their own work sessions.'});if(existing?.status==='rework_required'){const center=await getControlCenter(actor.id),replacement=(center.documents||[]).some(d=>String(d.sourceRef)===String(existing.id)&&Number(d.revision||1)>1&&['PENDING_REVIEW','APPROVED'].includes(String(d.status)));if(!replacement)return res.status(409).json({error:'Upload the updated replacement document before clocking out the rework session.'});}const row=await clockOutMtsSession({id:req.params.id,clockOutAt:b.clock_out_at,location:b.location||{},completionPercent:Number(b.completion_percent??100),onTime:Boolean(b.on_time),delayComments:b.delay_comments||'',sessionId:String(b.session_id||'')});await assignLiveContextCompany({employeeId:row.employee_id,projectCode:row.project_code,date:row.work_date,companyId:actor.companyId||'COMPANY-DEFAULT'});brainChanged('work-session-clock-out');res.json(row);}catch(e){next(e);}});
app.post('/api/mts/import', async (req,res,next)=>{try{await requirePrivileged(req);const b=req.body||{};if(!Array.isArray(b.records))return res.status(400).json({error:'records must be an array.'});const rows=await importLegacyMtsRecords(b.records,{sessionId:String(b.session_id||''),bridgeCompleted:Boolean(b.bridge_completed)});brainChanged('work-activity-import');res.status(201).json(rows);}catch(e){next(e);}});
app.get('/api/mts/messages', async (req,res,next)=>{try{const actor=await requireActor(req);let rows=await listMtsMessages({limit:Number(req.query.limit||1000)});if(actor.role==='Employee'){const ids=new Set([actor.id,actor.name,actor.email,'all','everyone','system'].filter(Boolean).map(x=>String(x).toLowerCase()));rows=rows.filter(x=>ids.has(String(x.recipient||'').toLowerCase()));}else if(req.query.recipient)rows=rows.filter(x=>String(x.recipient)===String(req.query.recipient));res.json(rows.slice(0,Number(req.query.limit||100)));}catch(e){next(e);}});
app.post('/api/mts/messages', async (req,res,next)=>{try{const actor=await requireActor(req),b=req.body||{};res.status(201).json(await createMtsMessage({recipient:b.recipient,sender:actor.name||actor.id,content:b.content,sessionId:String(b.session_id||'')}));}catch(e){next(e);}});

app.patch('/api/mts/messages/:id/read', async (req,res,next)=>{try{const actor=await requireActor(req);if(actor.role==='Employee'){const row=(await listMtsMessages({limit:1000})).find(x=>String(x.id)===String(req.params.id)),ids=new Set([actor.id,actor.name,actor.email,'all','everyone','system'].filter(Boolean).map(x=>String(x).toLowerCase()));if(!row||!ids.has(String(row.recipient||'').toLowerCase()))return res.status(403).json({error:'This message is outside your recipient scope.'});}res.json(await markMtsMessageRead(req.params.id,{reader:actor.name||actor.id}));}catch(e){next(e);}});

// Dashboard control center: notifications, documents, assigned reviews, settings and application profile.
app.get('/api/control-center', async (req,res,next)=>{try{
  const actorId=String(req.authUserId||'');const base=await getControlCenter(actorId);const actor=base.profile.currentUser;
  const reviews=await listControlReviews({actorId});const allMessages=await listMtsMessages({limit:500});const identities=new Set([actor?.id,actor?.name,actor?.email].filter(Boolean).map(x=>String(x).toLowerCase()));
  const messages=allMessages.filter(m=>!m.read && (!m.recipient || identities.has(String(m.recipient).toLowerCase()) || ['all','everyone','system'].includes(String(m.recipient).toLowerCase())));
  const advisorMessages=actorId?await unreadSystemBrainMessages(actorId,{limit:100}):[];
  const tasks=(await listRecords({limit:250,recordType:'task'})).filter(t=>['active','pending','open'].includes(String(t.status||'active').toLowerCase())).filter(t=>{const a=String(t.metadata?.assigned_to||t.metadata?.assignee||'').trim().toLowerCase();return !a||identities.has(a)||['Administrator','Developer'].includes(actor?.role);});
  const notifications=[...reviews.map(r=>({id:`review:${r.id}`,kind:'review',title:r.title,detail:r.detail,created_at:r.createdAt||'',review_id:r.id,status:r.status})),...tasks.map(t=>({id:`task:${t.id}`,kind:'task',title:t.title,detail:t.content,created_at:t.created_at,task_id:t.id,status:t.status})),...advisorMessages.map(m=>({id:`advisor:${m.id}`,kind:'advisor',title:'Recovery Agent',detail:m.content,created_at:m.created_at,advisor_message_id:m.id,status:'AI ADVICE'})),...messages.map(m=>({id:`message:${m.id}`,kind:'message',title:`Message from ${m.sender||'System'}`,detail:m.content,created_at:m.created_at,message_id:m.id,status:'UNREAD'}))];
  res.json({...base,reviews,messages,advisorMessages,tasks,notifications,brain:actorId?await systemBrainStatus(actorId):null});
}catch(e){next(e);}});
app.post('/api/control-center/login', async (req,res,next)=>{try{const result=await loginControlUser(req.body||{}),token=await issueAuthSession(result.currentUser.id);setAuthCookie(res,token);res.json(result);}catch(e){e.statusCode=401;next(e);}});
app.post('/api/control-center/register', async (req,res,next)=>{try{const result=await registerControlUser(req.body||{}),token=await issueAuthSession(result.currentUser.id);setAuthCookie(res,token);res.status(201).json(result);}catch(e){e.statusCode=e.statusCode||400;next(e);}});
app.post('/api/control-center/companies/executive', async (req,res,next)=>{try{const actor=await requireDeveloper(req);res.status(201).json(await createCompanyWithExecutive(req.body||{},actor.id));brainChanged('company-executive-created');}catch(e){next(e);}});
app.post('/api/control-center/companies', async (req,res,next)=>{try{const actor=await requireDeveloper(req);res.status(201).json(await createCompany(req.body||{},actor.id));}catch(e){next(e);}});
app.post('/api/control-center/users', async (req,res,next)=>{try{const actor=await requireDeveloper(req);res.status(201).json(await createControlUserByDeveloper(req.body||{},actor.id));}catch(e){next(e);}});
app.delete('/api/control-center/users/:id', async (req,res,next)=>{try{const actor=await requireDeveloper(req);res.json(await deleteControlUser(req.params.id,actor.id));}catch(e){next(e);}});
app.patch('/api/control-center/users/:id/role', async (req,res,next)=>{try{const actor=await requirePrivileged(req);res.json(await assignControlRole(req.params.id,{...req.body,actorId:actor.id}));}catch(e){next(e);}});
app.post('/api/control-center/logout', async (req,res,next)=>{try{await revokeAuthSession(req.authToken);clearAuthCookie(res);res.json({signedIn:false});}catch(e){next(e);}});
app.patch('/api/control-center/profile', async (req,res,next)=>{try{res.json(await updateControlProfile(req.body||{},req.authUserId));}catch(e){next(e);}});
app.patch('/api/control-center/settings', async (req,res,next)=>{try{res.json(await updateControlSettings(req.body||{},req.authUserId));}catch(e){next(e);}});
app.post('/api/control-center/documents', async (req,res,next)=>{try{const actor=await requireActor(req),body={...(req.body||{})};if(actor.role==='Employee'){body.employeeId=actor.id;body.employeeName=actor.name;body.companyId=actor.companyId;}else if(actor.role==='Administrator'){const profile=await getControlProfile(actor.id),allowed=new Set((profile.users||[]).map(u=>String(u.id)));if(body.employeeId&&!allowed.has(String(body.employeeId)))return res.status(403).json({error:'Administrators may upload documents only for users in their company.'});body.companyId=actor.companyId;}body.actorId=actor.id;const row=await ingestControlDocument(body);brainChanged('document-uploaded');res.status(201).json(row);}catch(e){next(e);}});
app.get('/api/control-center/documents/:id/content', async (req,res,next)=>{try{res.json(await getControlDocumentContent(req.params.id,req.authUserId));}catch(e){if(/not found/i.test(e.message))e.statusCode=404;next(e);}});
app.post('/api/control-center/documents/:id/review', async (req,res,next)=>{try{const actor=await requirePrivileged(req),row=await reviewControlDocument(req.params.id,{action:req.body?.action,note:req.body?.note,actorId:actor.id});if(row.status==='REJECTED'&&row.source==='Work Activity Hub'&&row.sourceRef)await markMtsSessionDocumentRework(row.sourceRef,{reason:row.reviewNote,sessionId:String(req.body?.session_id||'')});brainChanged('document-review-action');res.json(row);}catch(e){next(e);}});
app.post('/api/control-center/reviews/:id/action', async (req,res,next)=>{try{const actor=await requirePrivileged(req),row=await actOnControlReview(req.params.id,{action:req.body?.action,note:req.body?.note,actorId:actor.id});if(row?.status==='REJECTED'&&row?.source==='Work Activity Hub'&&row?.sourceRef)await markMtsSessionDocumentRework(row.sourceRef,{reason:row.reviewNote,sessionId:String(req.body?.session_id||'')});brainChanged('human-review-action');res.json(row);}catch(e){next(e);}});
app.post('/api/control-center/reviews/agent', async (req,res,next)=>{try{res.status(201).json(await saveAgentApprovalReview({...req.body,actorId:(await requireActor(req)).id}));}catch(e){next(e);}});
app.patch('/api/control-center/reviews/:id/resolve', async (req,res,next)=>{try{const actor=await requirePrivileged(req);const row=await resolveStoredControlReview(req.params.id,{decision:req.body?.decision,actorId:actor.id,note:req.body?.note});brainChanged('stored-review-resolved');res.json(row);}catch(e){next(e);}});
app.patch('/api/control-center/tasks/:id/complete', async (req,res,next)=>{try{await requireActor(req);const row=await updateRecordStatus(req.params.id,'completed');brainChanged('task-completed');res.json(row);}catch(e){next(e);}});


// System reasoning brain: persistent user-visible conversation + proactive advisory notifications.
app.get('/api/brain/status', async (req,res,next)=>{try{const actorId=String(req.authUserId||'');res.json(await systemBrainStatus(actorId));}catch(e){next(e);}});
app.get('/api/brain/thread', async (req,res,next)=>{try{const actorId=String(req.authUserId||'');res.json(await getSystemBrainThread(actorId,{limit:Number(req.query.limit||150)}));}catch(e){next(e);}});
app.post('/api/brain/chat', async (req,res,next)=>{try{const actorId=String(req.authUserId||''),message=String(req.body?.message||'').trim(),runId=String(req.body?.run_id||'').trim();if(!message)return res.status(400).json({error:'Message is required.'});res.json(await chatWithSystemBrain({actorId,message,runId}));}catch(e){next(e);}});
app.get('/api/brain/activity', async (req,res,next)=>{try{const runId=String(req.query.run_id||'').trim();if(!runId)return res.status(400).json({error:'run_id is required.'});res.json(await listAgentActivity({runId,after:Number(req.query.after||0),limit:Number(req.query.limit||100)}));}catch(e){next(e);}});
app.post('/api/brain/predict', async (req,res,next)=>{try{const actorId=String(req.authUserId||''),text=String(req.body?.text||'').trim();res.json(await predictSystemBrainContinuation({actorId,text}));}catch(e){next(e);}});
app.post('/api/brain/resume', async (req,res,next)=>{try{const actor=await requirePrivileged(req),actorId=actor.id,approvalState=String(req.body?.approval_state||'');if(!approvalState)return res.status(400).json({error:'approval_state is required.'});const decisions=Array.isArray(req.body?.decisions)?req.body.decisions.map(Boolean):[];res.json(await resumeSystemBrain({actorId,approvalState,decisions}));}catch(e){next(e);}});
app.post('/api/brain/scan', async (req,res,next)=>{try{const actorId=String(req.authUserId||'');res.json(await scanSystemBrain({actorId,reason:String(req.body?.reason||'manual-user-refresh'),force:Boolean(req.body?.force)}));}catch(e){next(e);}});
app.patch('/api/brain/messages/:id/read', async (req,res,next)=>{try{const actorId=String(req.authUserId||'');res.json(await readSystemBrainMessage(actorId,req.params.id));}catch(e){next(e);}});
app.delete('/api/brain/thread', async (req,res,next)=>{try{const actorId=String(req.authUserId||''),startNew=String(req.query.start_new||'true')!=='false';res.json(await clearSystemBrain(actorId,{startNew}));}catch(e){next(e);}});

app.get('/api/session/:id', async (req,res,next)=>{try{await requirePrivileged(req);const s=new PersistentSession(req.params.id);res.json({session_id:req.params.id,items:await s.getItems(Number(req.query.limit||100))});}catch(e){next(e);}});
app.delete('/api/session/:id', async (req,res,next)=>{try{await requirePrivileged(req);const s=new PersistentSession(req.params.id);await s.clearSession();res.json({cleared:true,session_id:req.params.id});}catch(e){next(e);}});

app.post('/api/agent', async (req,res,next)=>{
  try{
    const message=String(req.body?.message||'').trim(); if(!message)return res.status(400).json({error:'Message is required.'});
    const actor=await requireActor(req),sessionId=`USER-${actor.id}-${String(req.body?.session_id||'default')}`; res.json(await runAgentWorkflow({message,sessionId,userContext:actor?{id:actor.id,name:actor.name,role:actor.role,email:actor.email||''}:{}}));
  }catch(e){next(e);}
});
app.post('/api/agent/resume', async (req,res,next)=>{
  try{
    const actor=await requirePrivileged(req);
    const approvalState=String(req.body?.approval_state||''); if(!approvalState)return res.status(400).json({error:'approval_state is required.'});
    const decisions=Array.isArray(req.body?.decisions)?req.body.decisions.map(Boolean):[]; const sessionId=`USER-${actor.id}-${String(req.body?.session_id||'default')}`;
    res.json(await resumeAgentWorkflow({approvalState,decisions,sessionId}));
  }catch(e){next(e);}
});

app.get('*path', (_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((error,_req,res,_next)=>{console.error(error);res.status(Number(error?.statusCode||500)).json({error:error?.message||'Unexpected server error.'});});
requireSupabaseConfig();
await initializeIntelligence();
startSystemBrainMonitor({intervalMs:Number(process.env.AI_ADVISOR_SCAN_MS||45000)});
scheduleSystemBrainScan({reason:'startup',delay:1400});
app.listen(port,()=>console.log(`ADRA Recovery Passport API server is running on port ${port}. OpenAI-powered agent tasks require OPENAI_API_KEY and do not use a local-model fallback.`));
