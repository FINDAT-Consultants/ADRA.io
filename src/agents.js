import { Agent, Runner, RunState, tool, withTrace } from '@openai/agents';
import { z } from 'zod';
import { engine, formulaCatalog } from './engine-runtime.js';
import { trainingOverview, queryTrainingSheet } from './training-data-store.js';
import { listMappings, recordMapping, suggestFromMappings } from './learning-store.js';
import { getKnowledgeOverview, searchKnowledge } from './knowledge-base.js';
import { listMemories, searchMemories, saveMemory, memoryOverview } from './memory-store.js';
import { listRecords, searchRecords, saveRecord, updateRecordStatus, listActions, logAction } from './record-store.js';
import { PersistentSession } from './persistent-session.js';
import { addDraftTimeEntry, initializeRuntimeEntries } from './operational-store.js';
import { searchMtsSessions, listMtsSessions, getMtsOverview, clockInMtsSession, clockOutMtsSession, createMtsMessage, listMtsMessages, getUnifiedEvidenceTrace } from './mts-store.js';
import { getIntelligenceStatus, getLiveIntelligenceInsights, predictProjectCoding } from './intelligence-engine.js';
import { calculateExpression, summarizeNumbers, solveProbability } from './math-engine.js';
import { getLiveState, upsertLiveEmployee, upsertLiveProject, upsertLivePayroll, upsertLiveCalendar, addLiveTimeEntry, upsertLiveVacancy, upsertLiveCandidate, upsertLiveOnboarding } from './live-data-store.js';
import { getControlCenter, getControlProfile, listControlReviews, actOnControlReview, updateControlSettings } from './control-center-store.js';
import { beginAgentActivityRun, pushAgentActivity, completeAgentActivityRun, listAgentActivity } from './agent-activity-store.js';

await initializeRuntimeEntries();

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
const runner = new Runner({
  traceMetadata: {
    trace_source: 'adra-recovery-intelligent-memory',
    workflow_id: 'adra-recovery-passport-memory-grounded-agent'
  }
});

function safeJson(value) { return JSON.stringify(value); }
function normalizeMonth(month) { return month ? (month.length === 7 ? `${month}-01` : month) : null; }
function currentCommand(runContext){ return String(runContext?.context?.userMessage||'').trim(); }
function currentActor(runContext){ return runContext?.context?.userContext||{}; }
function commandHas(text,words=[]){ const q=` ${String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()} `; return words.some(w=>{const p=String(w||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();return Boolean(p)&&q.includes(` ${p} `);}); }
function requireExplicitCommand(runContext,{verbs=[],label='this action'}={}){
  const text=currentCommand(runContext);
  if(!text||!commandHas(text,verbs)) throw new Error(`I can only execute ${label} when the user explicitly instructs it in the current message.`);
  return text;
}
function requireRole(runContext,{admin=false,reviewer=false,label='this action'}={}){
  const actor=currentActor(runContext);
  if(admin && !(actor?.role==='Administrator'||actor?.canManageSettings)) throw new Error(`${label} requires Administrator or Settings permission.`);
  if(reviewer && !(actor?.role==='Administrator'||actor?.canReview)) throw new Error(`${label} requires assigned review authority.`);
  return actor;
}
async function visibleAction(runContext,{view='',panel='',selector='',label='',phase='action',metadata={}}={},fn){
  const runId=String(runContext?.context?.activityRunId||'');
  const actor=currentActor(runContext);
  if(runId) await pushAgentActivity({runId,actorId:actor?.id||'',phase,view,panel,selector,label,status:'working',metadata});
  try{
    const value=await fn();
    if(runId) await pushAgentActivity({runId,actorId:actor?.id||'',phase:'result',view,panel,selector,label:`Completed: ${label}`,status:'completed',metadata});
    return value;
  }catch(error){
    if(runId) await pushAgentActivity({runId,actorId:actor?.id||'',phase:'error',view,panel,selector,label:`Could not complete: ${label}`,status:'error',metadata:{...metadata,error:error.message}});
    throw error;
  }
}

async function buildGrounding(message, sessionId, userContext={}) {
  const [knowledge, memories, records, learning, workEvidence] = await Promise.all([
    searchKnowledge(message, { limit: 6 }),
    searchMemories(message, { limit: 6 }),
    searchRecords(message, { limit: 6 }),
    suggestFromMappings(message),
    searchMtsSessions(message, { limit: 6 })
  ]);
  return {
    sessionId,
    currentUser: userContext && typeof userContext==='object' ? userContext : {},
    query: message,
    relevantKnowledge: knowledge.map(x => ({ id:x.id,title:x.title,content:x.content.slice(0,1400),authority:x.authority,source:x.source })),
    relevantMemory: memories.map(x => ({ id:x.id,title:x.title,content:x.content,authority:x.authority,category:x.category })),
    relevantRecords: records.map(x => ({ id:x.id,title:x.title,content:x.content,record_type:x.record_type,status:x.status })),
    relevantWorkEvidence: workEvidence.map(x => ({ id:x.id,date:x.work_date,employee:x.employee_name,department:x.department,project_code:x.project_code,activity:x.activity_description,duration_hours:x.duration_hours,status:x.status,recovery_entry_id:x.recovery_entry_id,recovery_bridge_status:x.recovery_bridge_status })),
    learnedCodingPatterns: learning.slice(0,5).map(x => ({ activity:x.activity_example||x.activity_key,project_code:x.project_code,accepted_count:x.accepted_count,similarity:x.similarity })),
    adaptiveIntelligence: getIntelligenceStatus()
  };
}

const calculatorTool = tool({
  name:'calculate_expression',
  description:'Deterministically evaluate a mathematical expression. Use this for arithmetic and functions such as sqrt, sin, cos, log, ln, exp, abs, round, min, max and pow. Use ^ for exponentiation. Always use this tool to verify non-trivial numeric calculations before giving a final numeric answer.',
  parameters:z.object({expression:z.string().min(1)}),
  execute:async({expression})=>safeJson(calculateExpression(expression))
});

const statisticsTool = tool({
  name:'calculate_statistics',
  description:'Deterministically calculate count, sum, mean, median, minimum, maximum, population variance and population standard deviation for a numeric dataset.',
  parameters:z.object({values:z.array(z.number()).min(1).max(5000)}),
  execute:async({values})=>safeJson(summarizeNumbers(values))
});

const probabilityTool = tool({
  name:'calculate_probability',
  description:'Deterministically solve supported probability calculations. Modes: bayes (prior, likelihood, alternativeLikelihood), binomial (n, k, p), and expected_value (values, probabilities). Use this when the user asks for probability, risk, likelihood or expected value and the inputs are known.',
  parameters:z.object({
    mode:z.enum(['bayes','binomial','expected_value']),
    prior:z.number().min(0).max(1).optional(),
    likelihood:z.number().min(0).max(1).optional(),
    alternativeLikelihood:z.number().min(0).max(1).optional(),
    n:z.number().int().min(0).optional(),
    k:z.number().int().min(0).optional(),
    p:z.number().min(0).max(1).optional(),
    values:z.array(z.number()).optional(),
    probabilities:z.array(z.number().min(0).max(1)).optional()
  }),
  execute:async(args)=>safeJson(solveProbability(args))
});

const overviewTool = tool({
  name: 'get_live_data_overview',
  description: 'Return live operational record counts and the deterministic formula count. Historical prototype records are excluded.',
  parameters: z.object({}),
  execute: async () => safeJson({
    mode:'LIVE_OPERATIONAL_DATA',
    time_records: engine.state.timeEntries.length,
    employees: engine.state.employees.length,
    projects: engine.state.projects.length,
    calendar_days: engine.state.calendar.length,
    payroll_rows: engine.state.payroll.length,
    formula_rules: formulaCatalog.length,
    accounting_boundary: 'Only live operational state may drive current hours, payroll allocation, eligibility, checks, posting status and vouchers.'
  })
});

const querySheetTool = tool({
  name: 'query_training_reference',
  description: 'Read archived prototype workbook rows as TRAINING_REFERENCE_ONLY. Never use these rows as current operational/accounting facts.',
  parameters: z.object({
    sheet: z.enum(['Start Here','Dashboard','Time Entry','Employees','Projects','Payroll','Calendar','Monthly Engine','Checks','Voucher','Sources']),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(25),
    contains: z.string().optional()
  }),
  execute: async ({ sheet, offset, limit, contains }) => safeJson(await queryTrainingSheet(sheet,{offset,limit,contains:contains||''}))
});

const dashboardTool = tool({
  name: 'get_dashboard', description: 'Calculate all dashboard KPIs and monthly dashboard rows using the deterministic workbook engine.', parameters: z.object({}),
  execute: async () => safeJson(engine.dashboard())
});

const monthlyTool = tool({
  name: 'calculate_monthly_engine',
  description: 'Calculate expected/recorded hours, payroll, cost allocation, readiness, exceptions, posting status and recovery rate from workbook logic.',
  parameters: z.object({ month: z.string().optional().describe('Optional YYYY-MM or YYYY-MM-01') }),
  execute: async ({ month }) => { const rows=engine.monthlyEngine(); const key=normalizeMonth(month); return safeJson(key ? rows.find(r=>r.month===key)||null : rows); }
});

const voucherTool = tool({
  name: 'calculate_recovery_passport',
  description: 'Calculate a project voucher and the five-key Recovery Passport. Use this tool before stating recoverable or blocked financial amounts.',
  parameters: z.object({ month:z.string(), project_code:z.string() }),
  execute: async ({ month,project_code }) => safeJson(engine.recoveryPassport(month,project_code))
});

const checksTool = tool({
  name:'get_control_checks',description:'Return source reconciliation, formula error count, blocked months and configuration status.',parameters:z.object({}),
  execute:async()=>safeJson(engine.checks())
});

const timeTool = tool({
  name:'analyze_time_entries',
  description:'Analyze time entries with daily reconciliation, project eligibility, AI coding check and assurance status.',
  parameters:z.object({month:z.string().optional(),project_code:z.string().optional(),assurance:z.enum(['PASS','REVIEW','BLOCK']).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(100).default(25)}),
  execute:async({month,project_code,assurance,offset,limit})=>{const key=normalizeMonth(month);let rows=engine.analyzedTimeEntries();if(key)rows=rows.filter(r=>r.month===key);if(project_code)rows=rows.filter(r=>r.projectCode===project_code);if(assurance)rows=rows.filter(r=>r.entryAssurance===assurance||r.projectEligibility===assurance);return safeJson({total:rows.length,rows:rows.slice(offset,offset+limit)});}
});

const calendarTool = tool({
  name:'get_calendar_analysis',description:'Return calculated calendar rows with standard hours, recorded hours, variance and daily status.',
  parameters:z.object({month:z.string().optional()}),execute:async({month})=>{const key=normalizeMonth(month);return safeJson(engine.calendarAnalysis().filter(r=>!key||r.month===key));}
});

const masterDataTool = tool({
  name:'get_master_data',description:'Return Employees, Projects, Payroll or Sources from the workbook-derived state.',parameters:z.object({area:z.enum(['employees','projects','payroll','sources'])}),
  execute:async({area})=>safeJson(area==='payroll'?engine.payrollAnalysis():engine.state[area])
});

const formulasTool = tool({
  name:'get_formula_catalog',description:'Return workbook formula definitions and their deterministic application logic.',parameters:z.object({sheet:z.string().optional(),search:z.string().optional()}),
  execute:async({sheet,search})=>{let rows=formulaCatalog;if(sheet)rows=rows.filter(r=>r.sheet.toLowerCase()===sheet.toLowerCase());if(search){const q=search.toLowerCase();rows=rows.filter(r=>[r.sheet,r.field,r.excel,r.logic].join(' ').toLowerCase().includes(q));}return safeJson(rows);}
});

const knowledgeSearchTool = tool({
  name:'search_foundational_knowledge',
  description:'Search the embedded Cost Recovery design knowledge plus workbook formula definitions. Use it for policy, control design, roles, AI boundaries, workflow, recommendations and rationale.',
  parameters:z.object({query:z.string().min(2),limit:z.number().int().min(1).max(20).default(8)}),
  execute:async({query,limit})=>safeJson(await searchKnowledge(query,{limit}))
});

const knowledgeOverviewTool = tool({name:'get_knowledge_overview',description:'Describe the embedded knowledge layers and authority model.',parameters:z.object({}),execute:async()=>safeJson(await getKnowledgeOverview())});

const memorySearchTool = tool({
  name:'search_system_memory',description:'Search persistent confirmed facts, decisions, instructions, lessons and observations stored by the system.',
  parameters:z.object({query:z.string().min(2),limit:z.number().int().min(1).max(20).default(8)}),execute:async({query,limit})=>safeJson(await searchMemories(query,{limit}))
});

const memoryListTool = tool({name:'list_system_memory',description:'List persistent system memory for audit or review.',parameters:z.object({limit:z.number().int().min(1).max(200).default(50)}),execute:async({limit})=>safeJson(await listMemories({limit}))});

const memorySaveTool = tool({
  name:'save_system_memory',
  description:'Save durable application memory. Use only when the user explicitly asks to remember/store something, confirms a durable fact/decision, or a completed task creates an authoritative system fact. Never store speculation as CONFIRMED.',
  parameters:z.object({title:z.string().min(2),content:z.string().min(2),category:z.enum(['fact','decision','instruction','lesson','preference','observation','policy']).default('fact'),authority:z.enum(['CONFIRMED','OBSERVATION','AGENT_ADVICE']).default('CONFIRMED'),importance:z.number().min(0).max(1).default(0.7),tags:z.array(z.string()).default([])}),
  execute:async(args,runContext)=>safeJson(await saveMemory({...args,sourceType:'agent_tool',sessionId:runContext.context?.sessionId||''}))
});

const memoryOverviewTool = tool({name:'get_memory_overview',description:'Return counts of persistent memory by category and authority.',parameters:z.object({}),execute:async()=>safeJson(await memoryOverview())});

const recordSearchTool = tool({name:'search_stored_records',description:'Search operational notes, tasks, exception notes and other records stored by the application.',parameters:z.object({query:z.string().min(2),limit:z.number().int().min(1).max(20).default(8)}),execute:async({query,limit})=>safeJson(await searchRecords(query,{limit}))});

const recordListTool = tool({name:'list_stored_records',description:'List stored operational records and tasks.',parameters:z.object({record_type:z.string().optional(),status:z.string().optional(),limit:z.number().int().min(1).max(200).default(50)}),execute:async({record_type,status,limit})=>safeJson(await listRecords({recordType:record_type,status,limit}))});

const recordSaveTool = tool({
  name:'save_system_record',description:'Create a system note, task, exception note, follow-up, analysis note or other operational record when the user asks the system to store or create it.',
  parameters:z.object({record_type:z.enum(['note','task','exception_note','analysis','follow_up','knowledge_note']).default('note'),title:z.string().min(2),content:z.string().min(2),status:z.string().default('active'),metadata:z.record(z.string(),z.any()).default({})}),
  execute:async(args,runContext)=>{const row=await saveRecord({recordType:args.record_type,title:args.title,content:args.content,status:args.status,metadata:args.metadata,source:'agent',sessionId:runContext.context?.sessionId||''});await logAction({sessionId:runContext.context?.sessionId||'',actionName:'save_system_record',inputData:args,resultData:row,status:'completed'});return safeJson(row);}
});

const recordStatusTool = tool({
  name:'update_record_status',description:'Update the status of a stored task or operational record. Use only when the user instructs the status change.',
  parameters:z.object({id:z.union([z.string(),z.number()]),status:z.string().min(1)}),
  execute:async({id,status},runContext)=>{requireExplicitCommand(runContext,{verbs:['complete','mark','update','close','resolve'],label:'a task/record status change'});return visibleAction(runContext,{view:'dashboard',selector:'[data-control-panel=\"notifications\"]',label:`Updating task/record ${id} to ${status}`},async()=>{const row=await updateRecordStatus(id,status);await logAction({sessionId:runContext.context?.sessionId||'',actionName:'update_record_status',inputData:{id,status},resultData:row,status:'completed'});return safeJson(row);});}
});

const addDraftTimeTool = tool({
  name:'add_draft_time_entry',
  description:'Create a DRAFT time entry in the operational store when explicitly commanded. This never approves time.',
  parameters:z.object({date:z.string().min(10),project_code:z.string().min(1),hours:z.number().positive().max(24),activity:z.string().min(3),employee_id:z.string().default('E001')}),
  execute:async({date,project_code,hours,activity,employee_id},runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','record','enter','save'],label:'a draft recovery-time entry'});return visibleAction(runContext,{view:'time',selector:'#saveScenario',label:`Creating draft recovery time for ${employee_id}`},async()=>safeJson(await addDraftTimeEntry({date,projectCode:project_code,hours,activity,employeeId:employee_id,sessionId:runContext.context?.sessionId||''})));}
});

const suggestionTool = tool({
  name:'suggest_project',description:'Suggest project coding from human-confirmed mappings and active project master data. Suggestions remain advisory.',parameters:z.object({activity:z.string().min(3)}),
  execute:async({activity})=>safeJson({activity,learned_matches:await suggestFromMappings(activity),adaptive_ml_predictions:predictProjectCoding(activity,{limit:5}),eligible_projects:engine.state.projects.filter(p=>p.status==='Active').map(p=>({code:p.code,name:p.name,donor:p.donor})),authority:'ADVISORY_ONLY_HUMAN_CONFIRMATION_REQUIRED'})
});

const learningTool = tool({
  name:'record_confirmed_mapping',description:'Store an activity-to-project mapping only after explicit human confirmation. This is auditable application learning, not model retraining.',
  parameters:z.object({activity:z.string().min(3),project_code:z.string(),human_confirmed:z.literal(true),note:z.string().optional()}),
  execute:async({activity,project_code,note},runContext)=>{if(!engine.state.projects.some(p=>p.code===project_code))throw new Error('Unknown project code.');const row=await recordMapping({activity,projectCode:project_code,confirmedBy:'human',note:note||''});await logAction({sessionId:runContext.context?.sessionId||'',actionName:'record_confirmed_mapping',inputData:{activity,project_code},resultData:row,status:'completed'});return safeJson(row);}
});

const learningStatusTool = tool({name:'get_learning_status',description:'Return auditable human-confirmed activity coding mappings.',parameters:z.object({}),execute:async()=>safeJson(await listMappings())});

const patternTool = tool({
  name:'analyze_recovery_patterns',description:'Analyze the full embedded operational dataset for recovery patterns, anomalies and management opportunities. Returns evidence; the agent may form its own advice from it.',parameters:z.object({month:z.string().optional()}),
  execute:async({month})=>{
    const key=normalizeMonth(month); const entries=engine.analyzedTimeEntries().filter(e=>!key||e.month===key); const monthly=engine.monthlyEngine().filter(m=>!key||m.month===key);
    const projectHours=engine.projectSummary(key).slice(0,15); const assurance={pass:entries.filter(e=>e.entryAssurance==='PASS').length,review:entries.filter(e=>e.entryAssurance!=='PASS').length,eligibility_blocks:entries.filter(e=>e.projectEligibility==='BLOCK').length,daily_reviews:entries.filter(e=>e.dailyCheck!=='PASS').length};
    return safeJson({period:key||'all',records:entries.length,monthly,project_hours:projectHours,assurance,blocked_months:monthly.filter(m=>m.postingStatus==='BLOCKED').map(m=>({month:m.monthLabel,variance:m.hoursVariance,unrecovered_cost:m.unrecoveredCost,exceptions:m.criticalExceptions}))});
  }
});


const intelligenceStatusTool = tool({
  name:'get_intelligence_status',
  description:'Return the server-side adaptive machine-learning/deep-learning status, feature-store counts, model maturity and authority boundaries.',
  parameters:z.object({}),
  execute:async()=>safeJson(getIntelligenceStatus())
});

const intelligenceInsightsTool = tool({
  name:'get_adaptive_intelligence_insights',
  description:'Return advisory ML/deep-learning recovery-risk predictions and live anomaly signals. These predictions never authorize accounting, posting or approval.',
  parameters:z.object({}),
  execute:async()=>safeJson(getLiveIntelligenceInsights())
});

const mlProjectCodingTool = tool({
  name:'predict_project_coding_ml',
  description:'Suggest project coding from the adaptive server-side classifier trained on historical reference patterns, human-confirmed mappings and confirmed live activity. Human confirmation remains required.',
  parameters:z.object({activity:z.string().min(3),limit:z.number().int().min(1).max(10).default(5)}),
  execute:async({activity,limit})=>safeJson({activity,predictions:predictProjectCoding(activity,{limit})})
});

const actionLogTool = tool({name:'get_agent_action_log',description:'Review recent actions carried out by the system agent for auditability.',parameters:z.object({limit:z.number().int().min(1).max(100).default(30)}),execute:async({limit})=>safeJson(await listActions(limit))});


const mtsOverviewTool = tool({
  name:'get_work_activity_overview',
  description:'Analyze Master Time Schedule work sessions: active/completed sessions, hours, completion, top workers, overtime, job/department/project performance and Recovery Passport draft linkage.',
  parameters:z.object({month:z.string().optional()}),
  execute:async({month})=>safeJson(await getMtsOverview({month}))
});

const mtsListTool = tool({
  name:'list_work_sessions',
  description:'List operational clock-in/clock-out work sessions, including project, department, activity, locations, completion, comments, attachment metadata and Recovery Passport linkage.',
  parameters:z.object({status:z.enum(['active','completed']).optional(),project_code:z.string().optional(),employee_name:z.string().optional(),month:z.string().optional(),query:z.string().optional(),limit:z.number().int().min(1).max(200).default(50)}),
  execute:async({status,project_code,employee_name,month,query,limit})=>safeJson(await listMtsSessions({status,projectCode:project_code,employeeName:employee_name,month,query,limit}))
});

const mtsTraceTool = tool({
  name:'trace_work_evidence_to_recovery',
  description:'Trace one MTS work session through its linked draft/approved time entry, daily checks, monthly engine and Recovery Passport. Use this to explain the focal integration point.',
  parameters:z.object({mts_session_id:z.string().min(2)}),
  execute:async({mts_session_id})=>safeJson(await getUnifiedEvidenceTrace({mtsSessionId:mts_session_id}))
});

const mtsClockInTool = tool({
  name:'clock_in_work_session',
  description:'Start a Master Time Schedule work session for an employee/project/activity when the current user explicitly commands it. Project must exist in the Recovery Passport project master.',
  parameters:z.object({employee_id:z.string().default('E001'),department:z.string().min(2),project_code:z.string().min(1),activity_description:z.string().min(3)}),
  execute:async({employee_id,department,project_code,activity_description},runContext)=>{requireExplicitCommand(runContext,{verbs:['clock in','start work','start session','begin work','begin session'],label:'clock-in'});return visibleAction(runContext,{view:'work',selector:'#mtsClockInForm button[type=\"submit\"]',label:`Clocking in ${employee_id} on ${project_code}`},async()=>safeJson(await clockInMtsSession({employeeId:employee_id,department,projectCode:project_code,activityDescription:activity_description,sessionId:runContext.context?.sessionId||''})));}
});

const mtsClockOutTool = tool({
  name:'clock_out_work_session',
  description:'Complete an active MTS work session when the current user explicitly commands it. Completion creates a DRAFT Recovery Passport time entry when the duration/project are valid; it never approves the time.',
  parameters:z.object({session_id:z.string().min(2),completion_percent:z.number().min(0).max(100).default(100),on_time:z.boolean().default(true),delay_comments:z.string().default('')}),
  execute:async({session_id,completion_percent,on_time,delay_comments},runContext)=>{requireExplicitCommand(runContext,{verbs:['clock out','complete session','finish work','end session'],label:'clock-out'});return visibleAction(runContext,{view:'work',selector:'[data-mts-clockout]',label:`Clocking out work session ${session_id}`},async()=>safeJson(await clockOutMtsSession({id:session_id,completionPercent:completion_percent,onTime:on_time,delayComments:delay_comments,sessionId:runContext.context?.sessionId||''})));}
});

const mtsMessageListTool = tool({
  name:'list_internal_messages',description:'List internal Master Time Schedule / recovery follow-up messages.',
  parameters:z.object({recipient:z.string().optional(),limit:z.number().int().min(1).max(100).default(30)}),
  execute:async({recipient,limit})=>safeJson(await listMtsMessages({recipient,limit}))
});

const mtsMessageTool = tool({
  name:'send_internal_message',description:'Send an internal operational message/reminder to a named employee or role when the current user explicitly commands it. This does not send email or SMS.',
  parameters:z.object({recipient:z.string().min(2),content:z.string().min(2)}),
  execute:async({recipient,content},runContext)=>{requireExplicitCommand(runContext,{verbs:['send','message','tell','notify','remind'],label:'sending an internal message'});return visibleAction(runContext,{view:'work',selector:'#mtsMessageContent',label:`Sending an internal message to ${recipient}`},async()=>safeJson(await createMtsMessage({recipient,sender:currentActor(runContext)?.name||'ADRA AI Advisor',content,sessionId:runContext.context?.sessionId||''})));}
});


const navigateApplicationTool=tool({
  name:'navigate_application',
  description:'Open a named application module or dashboard control-center panel for the signed-in user. Use this when the user says open, go to, show, navigate to, or take me to a feature.',
  parameters:z.object({target:z.enum(['dashboard','company','assistant','insights','reports','work','time','employees','recruiting','onboarding','projects','payroll','calendar','monthly','checks','voucher','notifications','documents','reviews','settings','profile'])}),
  execute:async({target},runContext)=>{
    requireExplicitCommand(runContext,{verbs:['open','go','navigate','show','take'],label:`navigation to ${target}`});
    const panels=new Set(['notifications','documents','reviews','settings','profile']);
    const event=panels.has(target)?{view:'dashboard',panel:target,selector:`[data-control-panel="${target}"]`,label:`Opening ${target}`}:{view:target,selector:`[data-view="${target}"]`,label:`Opening ${target}`};
    return visibleAction(runContext,event,async()=>safeJson({opened:target}));
  }
});

const listAssignedReviewsTool = tool({
  name:'list_assigned_reviews',
  description:'List review/approval items assigned to the signed-in user. Use this before approving/rejecting when the user identifies an item by description rather than exact review ID.',
  parameters:z.object({include_all:z.boolean().default(false)}),
  execute:async({include_all},runContext)=>{const actor=currentActor(runContext);return safeJson(await listControlReviews({actorId:actor?.id||'',includeAll:Boolean(include_all)}));}
});

const executeReviewDecisionTool = tool({
  name:'execute_review_decision',
  description:'Approve, reject or acknowledge an assigned Reviews item when the CURRENT user message explicitly instructs that decision. The backend enforces reviewer assignment and control rules. This may approve time evidence, documents, or valid payroll configuration when the user has authority; blocked controls cannot be overridden.',
  parameters:z.object({review_id:z.string().min(2),action:z.enum(['approve','reject','acknowledge']),note:z.string().default('')}),
  execute:async({review_id,action,note},runContext)=>{
    const verbs=action==='approve'?['approve','approved','accept']:action==='reject'?['reject','rejected','decline']:['acknowledge','noted','mark reviewed'];
    requireExplicitCommand(runContext,{verbs,label:`${action} review ${review_id}`});const actor=requireRole(runContext,{reviewer:true,label:'Review decision'});
    return visibleAction(runContext,{panel:'reviews',selector:'#reviewList',label:`${action[0].toUpperCase()+action.slice(1)} review ${review_id}`},async()=>safeJson(await actOnControlReview(review_id,{action,note,actorId:actor.id})));
  }
});

const liveEmployeeWriteTool=tool({
  name:'create_or_update_employee',description:'Create or update a live employee profile when explicitly instructed by the user. This writes to the shared Company/Employees master used across the system.',
  parameters:z.object({employee_id:z.string().min(1),name:z.string().min(2),position:z.string().optional(),department:z.string().optional(),team:z.string().optional(),supervisor:z.string().optional(),email:z.string().optional(),phone:z.string().optional(),hours_per_day:z.number().min(0).max(24).default(8),employment_type:z.string().optional(),employment_status:z.string().optional(),location:z.string().optional(),active:z.string().default('Yes')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','save','change','edit'],label:'employee creation/update'});return visibleAction(runContext,{view:'employees',selector:'#employeeForm button[type="submit"]',label:`Saving employee ${args.name}`},async()=>safeJson(await upsertLiveEmployee(args)));}
});

const liveProjectWriteTool=tool({
  name:'create_or_update_project',description:'Create or update a live project master record when explicitly instructed by the user.',
  parameters:z.object({project_code:z.string().min(1),project_name:z.string().min(1),donor:z.string().optional(),start_date:z.string().optional(),end_date:z.string().optional(),status:z.string().default('Active'),admin_allowed:z.string().default('No'),personnel_budget:z.number().min(0).default(0),eligible_employee_id:z.string().optional()}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','save','change','edit'],label:'project creation/update'});return visibleAction(runContext,{view:'projects',selector:'#projectForm button[type="submit"]',label:`Saving project ${args.project_code}`},async()=>safeJson(await upsertLiveProject(args)));}
});

const livePayrollWriteTool=tool({
  name:'create_or_update_payroll',description:'Create or update an authorized live payroll input when the signed-in Administrator explicitly instructs it. This changes financial input data but does not bypass review, eligibility, or posting controls.',
  parameters:z.object({month:z.string().min(7),employee_id:z.string().min(1),basic_salary:z.number().min(0),benefits:z.number().min(0).default(0),statutory_cost:z.number().min(0).default(0),exclusions:z.number().min(0).default(0),source:z.string().min(2),configuration_status:z.enum(['COMPLETE','REVIEW','REJECTED']).default('COMPLETE'),notes:z.string().default('')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','save','change','set','edit'],label:'payroll change'});requireRole(runContext,{admin:true,label:'Payroll change'});return visibleAction(runContext,{view:'payroll',selector:'#payrollForm button[type="submit"]',label:`Saving payroll for ${args.employee_id}`},async()=>safeJson(await upsertLivePayroll(args)));}
});

const liveCalendarWriteTool=tool({
  name:'create_or_update_calendar_day',description:'Create or update a live work-calendar day when explicitly instructed by the user.',
  parameters:z.object({date:z.string().min(10),day_type:z.string().default('Working Day'),standard_hours:z.number().min(0).max(24).default(8),holiday_source:z.string().default('')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','save','set','change','edit'],label:'calendar change'});return visibleAction(runContext,{view:'calendar',selector:'#calendarForm button[type="submit"]',label:`Saving calendar day ${args.date}`},async()=>safeJson(await upsertLiveCalendar(args)));}
});

const liveTimeWriteTool=tool({
  name:'create_live_recovery_time_entry',description:'Create a live recovery time-evidence record when explicitly instructed. The agent may create Draft records directly; approval statuses should be changed through the Reviews workflow so reviewer authority is enforced.',
  parameters:z.object({date:z.string().min(10),employee_id:z.string().min(1),project_code:z.string().min(1),hours:z.number().positive().max(24),activity:z.string().min(3),status:z.literal('Draft').default('Draft')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','record','enter','save'],label:'recovery-time creation'});return visibleAction(runContext,{view:'time',selector:'#saveScenario',label:`Recording ${args.hours} hours for ${args.employee_id}`},async()=>safeJson(await addLiveTimeEntry(args)));}
});

const liveVacancyWriteTool=tool({
  name:'create_or_update_vacancy',description:'Create or update a live recruiting vacancy when explicitly instructed.',
  parameters:z.object({vacancy_id:z.string().optional(),job_title:z.string().min(2),department:z.string().optional(),location:z.string().optional(),employment_type:z.string().default('Full Time'),status:z.string().default('Open'),open_date:z.string().optional(),close_date:z.string().optional()}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','open','save','change','edit'],label:'vacancy change'});return visibleAction(runContext,{view:'recruiting',selector:'#vacancyForm button[type="submit"]',label:`Saving vacancy ${args.job_title}`},async()=>safeJson(await upsertLiveVacancy(args)));}
});

const liveCandidateWriteTool=tool({
  name:'create_or_update_candidate',description:'Create or update a live recruiting candidate when explicitly instructed.',
  parameters:z.object({candidate_id:z.string().optional(),candidate_name:z.string().min(2),email:z.string().optional(),phone:z.string().optional(),vacancy_id:z.string().optional(),job_title:z.string().optional(),department:z.string().optional(),location:z.string().optional(),employment_type:z.string().default('Full Time'),stage:z.string().default('Applied'),status:z.string().default('Active'),applied_date:z.string().optional(),notes:z.string().default('')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['add','create','update','move','save','change','edit'],label:'candidate change'});return visibleAction(runContext,{view:'recruiting',selector:'#candidateForm button[type="submit"]',label:`Saving candidate ${args.candidate_name}`},async()=>safeJson(await upsertLiveCandidate(args)));}
});

const liveOnboardingWriteTool=tool({
  name:'create_or_update_onboarding',description:'Create or advance a live onboarding record when explicitly instructed. Completing onboarding synchronizes the employee master.',
  parameters:z.object({onboarding_id:z.string().optional(),candidate_id:z.string().optional(),employee_id:z.string().min(1),employee_name:z.string().min(2),job_title:z.string().optional(),department:z.string().optional(),location:z.string().optional(),employment_type:z.string().default('Full Time'),hire_date:z.string().optional(),step:z.number().int().min(1).max(5).default(1),status:z.enum(['In Progress','Complete']).default('In Progress')}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['start','create','update','advance','complete','finish','move'],label:'onboarding change'});return visibleAction(runContext,{view:'onboarding',selector:'#onboardingStartBtn, [data-onboarding-nav]',label:`Updating onboarding for ${args.employee_name}`},async()=>safeJson(await upsertLiveOnboarding(args)));}
});

const settingsWriteTool=tool({
  name:'update_system_settings',description:'Update organization currency/hourly-rate settings when the signed-in Administrator explicitly instructs the change.',
  parameters:z.object({countryCode:z.string().optional(),country:z.string().optional(),currency:z.string().optional(),currencyName:z.string().optional(),defaultHourlyRate:z.number().min(0).optional(),employeeId:z.string().optional(),employeeRate:z.number().min(0).optional(),projectCode:z.string().optional(),projectRate:z.number().min(0).optional()}),
  execute:async(args,runContext)=>{requireExplicitCommand(runContext,{verbs:['set','change','update','save'],label:'Settings change'});const actor=requireRole(runContext,{admin:true,label:'Settings change'});return visibleAction(runContext,{panel:'settings',selector:'#controlSettingsForm button[type="submit"]',label:'Updating system settings'},async()=>safeJson(await updateControlSettings(args,actor.id)));}
});

const liveDataSnapshotTool=tool({
  name:'get_live_operational_state',description:'Return the live operational state for cross-module task planning. Use only when needed; historical training data is not included.',parameters:z.object({area:z.enum(['employees','projects','payroll','calendar','timeEntries','vacancies','candidates','onboarding']).optional()}),
  execute:async({area})=>{const state=getLiveState();return safeJson(area?state[area]||[]:state);}
});

const workActivityAgent = new Agent({
  name:'Work Activity Evidence Agent',model:MODEL,
  instructions:`Manage and analyze the Master Time Schedule operational evidence layer. Treat clock-in/out timestamps, activity descriptions, project coding, department, locations, attachment metadata, completion assessments and comments as work evidence. Completed MTS sessions create DRAFT Recovery Passport time entries; they do not become approved accounting time automatically. Use the workbook project master as the single project-code authority. You may analyze productivity and overtime indicators, but performance scores never authorize cost recovery. Never invent a location, clock time or completed action.`,
  tools:[mtsOverviewTool,mtsListTool,mtsTraceTool,mtsClockInTool,mtsClockOutTool,mtsMessageListTool,mtsMessageTool,suggestionTool,masterDataTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const dataAgent = new Agent({
  name:'Workbook Data Agent',model:MODEL,
  instructions:'Inspect workbook and structured source data. Retrieve before answering. Preserve source terminology and flag provisional, REVIEW, CONFIGURE or missing values. You may analyze patterns, but do not invent source facts.',
  tools:[overviewTool,querySheetTool,masterDataTool,calendarTool,timeTool,formulasTool,patternTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const knowledgeAgent = new Agent({
  name:'Knowledge Base Agent',model:MODEL,
  instructions:'Ground design, policy, roles, controls, AI boundaries, workflow and recommendations in the embedded Cost Recovery knowledge base and formula catalog. Distinguish source knowledge from your own inference.',
  tools:[knowledgeSearchTool,knowledgeOverviewTool,formulasTool,overviewTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const recoveryAgent = new Agent({
  name:'Recovery Calculation Agent',model:MODEL,
  instructions:'Explain and analyze financial recovery using deterministic tools. Always calculate before stating numeric financial results. You may advise on corrective actions and alternatives, but readiness never overrides the five-key/critical posting gate.',
  tools:[dashboardTool,monthlyTool,voucherTool,checksTool,formulasTool,patternTool],
  modelSettings:{reasoning:{effort:'high',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const memoryAgent = new Agent({
  name:'Memory and Learning Agent',model:MODEL,
  instructions:'Search persistent memory, stored operational records and confirmed coding mappings. Save durable memory only when explicitly requested or clearly confirmed. Treat OBSERVATION and AGENT_ADVICE as non-authoritative. Never convert an inference into a confirmed financial fact.',
  tools:[memorySearchTool,memoryListTool,memorySaveTool,memoryOverviewTool,recordSearchTool,recordListTool,recordSaveTool,recordStatusTool,suggestionTool,learningTool,learningStatusTool,actionLogTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const taskAgent = new Agent({
  name:'Task Execution Agent',model:MODEL,
  instructions:`Carry out explicit user commands across the connected application instead of merely describing what the user could do. Use the live write tools for Employees, Projects, Payroll, Calendar, Recovery Time, Recruiting and Onboarding; use Work Activity tools for clock-in/out and messages; use Reviews tools for assigned approve/reject/acknowledge decisions; use Settings only when the signed-in user has permission. Every write tool validates that the CURRENT user message contains an explicit action instruction and the backend enforces role/reviewer authority. Never claim a task was completed unless the tool succeeded. Do not invent missing IDs, amounts or dates: inspect live data first or ask one focused question. You may approve an assigned review when the user explicitly instructs you to approve it and the backend authorizes that user. You may not bypass a failed control, donor restriction, required source data, or authorize accounting journal posting.`,
  tools:[
    liveDataSnapshotTool,navigateApplicationTool,listAssignedReviewsTool,executeReviewDecisionTool,
    liveEmployeeWriteTool,liveProjectWriteTool,livePayrollWriteTool,liveCalendarWriteTool,liveTimeWriteTool,liveVacancyWriteTool,liveCandidateWriteTool,liveOnboardingWriteTool,settingsWriteTool,
    recordSaveTool,recordStatusTool,addDraftTimeTool,memorySaveTool,learningTool,recordSearchTool,masterDataTool,mtsClockInTool,mtsClockOutTool,mtsMessageTool,mtsListTool
  ],
  modelSettings:{reasoning:{effort:'high',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const codingAgent = new Agent({
  name:'Activity Coding Agent',model:MODEL,
  instructions:'Suggest project coding from confirmed learning and project data. Explain confidence and evidence. Never silently post or change coding. Store mappings only after explicit human confirmation.',
  tools:[suggestionTool,learningTool,learningStatusTool,masterDataTool,knowledgeSearchTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});


const mathReasoningAgent = new Agent({
  name:'Mathematics and Quantitative Reasoning Agent',model:MODEL,
  instructions:`Solve mathematical, statistical, financial-math and probability questions carefully. Use deterministic calculator/statistics/probability tools for numeric work instead of relying on mental arithmetic. For multi-step problems, identify the quantities and formula, calculate with tools, verify the result, then explain the solution clearly at an appropriate level. You may provide a concise derivation or calculation summary, but never expose private chain-of-thought. If a problem is underspecified, state the missing variable or assumption. Distinguish exact results from estimates.`,
  tools:[calculatorTool,statisticsTool,probabilityTool],
  modelSettings:{reasoning:{effort:'high',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const intelligenceAgent = new Agent({
  name:'Adaptive Intelligence Agent',model:MODEL,
  instructions:'Use the server-side adaptive machine-learning and deep-learning layer to identify patterns, anomalies, coding suggestions and recovery-risk signals. Treat every prediction as advisory. State model maturity/quality when relevant. Never use ML/DL probability to override deterministic financial formulas, evidence requirements, human approvals, donor eligibility or the Recovery Gate.',
  tools:[intelligenceStatusTool,intelligenceInsightsTool,mlProjectCodingTool,patternTool,learningStatusTool,timeTool,monthlyTool],
  modelSettings:{reasoning:{effort:'medium',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const manager = new Agent({
  name:'ADRA Recovery Passport Intelligent Agent',model:MODEL,
  instructions: async (runContext) => {
    const g=runContext.context?.grounding||{};
    return `You are the central reasoning and task agent for the ADRA Recovery Passport System.

You operate from NINE connected memory/evidence/intelligence/reasoning layers built around one UNIFIED WORK-EVIDENCE SPINE:
1. FOUNDATIONAL KNOWLEDGE — the embedded Cost Recovery design document plus the integrated Master Time Schedule design.
2. MASTER TIME SCHEDULE EVIDENCE — clock-in/out work sessions, activity, project, department, location, attachment metadata, completion, comments and operational analytics.
3. LIVE DETERMINISTIC DATA ENGINE — only current user/system-captured employee, project, payroll, calendar, time and Recovery Passport state.
4. TRAINING REFERENCE ARCHIVE — historical prototype workbook rows retained server-side only for examples/pattern context. They are NON-LIVE and NON-POSTING and must never be cited as current accounting facts.
5. PERSISTENT SYSTEM MEMORY — confirmed facts, decisions, instructions, lessons and non-authoritative observations stored by the application.
6. OPERATIONAL RECORDS — notes, tasks, exception notes and other data created by the system.
7. ADAPTIVE ML/DL INTELLIGENCE — server-side classifiers, anomaly detection and a compact deep neural network trained on historical reference patterns plus confirmed live outcomes. Predictions are advisory only.
8. CONVERSATION MEMORY — the persistent Agents SDK Session for this user/session, plus human-confirmed coding mappings.
9. QUANTITATIVE REASONING — deterministic mathematics, statistics and probability tools used to verify calculations before you state numeric conclusions.

FOCAL INTEGRATION RULE — THE UNIFIED WORK-EVIDENCE SPINE:
A real work activity begins in the Master Time Schedule. Clock-in/out and activity evidence create the operational record. On completion, the session creates a DRAFT Recovery Passport time entry. The deterministic engine then performs daily reconciliation, eligibility, monthly cost allocation and the five-key Recovery Passport controls. The same MTS session ID / recovery entry link lets you trace evidence to cost. Performance analytics are management information only and never substitute for approval or a passed Recovery Gate.

REASONING AND CONVERSATION:
Reason across the connected layers before answering: identify the user's intent, retrieve the relevant evidence, test important assumptions, consider consequences and then give a practical response. Converse naturally across turns like a careful professional colleague while remaining clearly an AI system. Handle both casual conversation and serious operational questions. Understand short follow-ups, references such as "that", "it", "the previous month", and corrections by using the persistent conversation session instead of restarting the discussion. You may form hypotheses, give professional advice, propose improvements, explain tradeoffs and recommend next actions. Do not merely repeat data.

For CAUSAL questions, distinguish correlation from causation. Build a concise cause → mechanism → consequence explanation, consider plausible alternative causes and counterfactuals, and do not claim a causal relationship unless the available evidence supports it. For SYSTEM questions, ground important claims in live tools and records. For GENERAL KNOWLEDGE questions that do not require current external information, answer from the model's general knowledge. If a question requires current public information that the application cannot retrieve, say that current external verification is needed rather than inventing a fresh fact.

For MATHEMATICS, STATISTICS, FINANCIAL MATH and PROBABILITY, delegate to the Mathematics and Quantitative Reasoning Agent and use deterministic tools to verify numeric results. When reasoning under uncertainty, use probability only when a probability is supplied, calculated, or reasonably estimable from evidence; never manufacture precise percentages. Distinguish a deterministic system status from an ML probability or a model-estimated likelihood.

Language generation is probabilistic: use the conversation context to anticipate likely intent and likely continuations, but respond to what the user actually wrote. If the user explicitly asks for likely next words or sentence continuations, provide several plausible continuations with clearly labelled estimated relative probabilities; do not present those estimates as calibrated token log-probabilities unless the API actually supplied log-probabilities.

Never expose hidden chain-of-thought; provide concise conclusions, equations, calculation summaries, evidence and key assumptions that support the answer. When advice goes beyond explicit source content, label it clearly as "Agent advice" or "Inference" where that distinction materially affects the decision. If key facts are missing, say what is missing and ask a focused question rather than inventing an answer.

ACCURACY STANDARD:
Use live deterministic tools for financial facts and system state. Cross-check calculations or high-impact status claims before presenting them. State uncertainty when evidence is incomplete. Do not claim to have feelings, consciousness or human identity. The user should experience a natural conversation, but the sender remains the ADRA AI Advisor / Recovery Agent. Never use a generic inventory/count summary as a fallback answer. Answer the user's actual question; when the user gives an actionable command, execute it with the appropriate tools instead of replying with unrelated record counts.

AUTHORITY RULES:
- Numeric financial results, hours, eligibility, payroll allocation, formula results, Recovery Gate, posting status and voucher amounts must come from LIVE deterministic engine tools.
- Archived training/reference rows may explain patterns or historical examples only; never mix them into live totals, current dashboards, checks or vouchers.
- Foundational design/policy claims should be grounded in the embedded knowledge base.
- CONFIRMED memory may be used as an operational fact unless it conflicts with the deterministic engine or foundational control rules.
- OBSERVATION and AGENT_ADVICE memory are context, not authoritative accounting evidence.
- Stored records are facts about what the system stored, but their contents may still be user notes rather than verified financial truth.

TASK EXECUTION:
When the user instructs you to carry out a supported task, use the Task Execution Agent/tools and DO THE WORK rather than returning instructions. This includes navigation plus Employees, Projects, Payroll, Calendar, Recovery Time, Recruiting, Onboarding, Work Activity, messages, Settings, tasks and assigned Reviews. If the user explicitly says approve/reject/acknowledge, identify the matching assigned review and execute that decision when backend permissions allow it. Do not ask for a second approval merely because the command itself is already explicit; the tool enforces identity/role rules. Report exactly what changed. If a required ID/date/amount is genuinely missing, ask only for that missing input. Tool execution emits a visible UI activity trace so the browser can show where the agent is working.

LEARNING:
Use confirmed activity-to-project mappings to improve future suggestions. Use persistent memory to remember durable confirmed decisions/instructions. The local adaptive models may retrain automatically on server-side data changes, but only from the designated training archive, deterministic outcomes and human-confirmed mappings. OpenAI foundation models are not silently retrained. Never silently change accounting rules or treat your own speculation as confirmed memory.

NON-NEGOTIABLE FINANCIAL CONTROLS:
You may approve or reject an assigned time/document/payroll review only when the signed-in user explicitly instructs that decision and the backend confirms their reviewer authority. You may enter or update payroll values only when explicitly instructed by an authorized Administrator. You may never fabricate salary values, override donor restrictions, bypass eligibility, override failed controls, or authorize accounting journal entries/posting. A review approval cannot make a failed deterministic control pass.

RELEVANT GROUNDING ALREADY RETRIEVED FOR THIS TURN:
${JSON.stringify(g, null, 2)}

If the grounding is insufficient, call the specialist/tools before answering. Never invent a successful tool action.`;
  },
  tools:[
    workActivityAgent.asTool({toolName:'work_activity_evidence_specialist',toolDescription:'Manage and analyze Master Time Schedule work sessions, operational performance, overtime, internal messages and evidence-to-recovery linkage.'}),
    dataAgent.asTool({toolName:'workbook_data_specialist',toolDescription:'Inspect workbook sheets, master data, formulas, time/calendar analysis and patterns.'}),
    knowledgeAgent.asTool({toolName:'knowledge_base_specialist',toolDescription:'Retrieve foundational design knowledge, controls, roles, AI boundaries and formula rationale.'}),
    recoveryAgent.asTool({toolName:'recovery_calculation_specialist',toolDescription:'Calculate and analyze Dashboard, Monthly Engine, Checks, Voucher and Recovery Passport results.'}),
    memoryAgent.asTool({toolName:'memory_learning_specialist',toolDescription:'Search/save persistent memory and records, inspect learning, and review action history.'}),
    taskAgent.asTool({toolName:'task_execution_specialist',toolDescription:'Carry out supported data/task operations, with approval where sensitive.'}),
    codingAgent.asTool({toolName:'activity_coding_specialist',toolDescription:'Suggest project coding and learn only from human-confirmed mappings.'}),
    mathReasoningAgent.asTool({toolName:'mathematics_reasoning_specialist',toolDescription:'Solve and verify mathematics, statistics, financial-math and probability questions with deterministic calculation tools.'}),
    intelligenceAgent.asTool({toolName:'adaptive_intelligence_specialist',toolDescription:'Use server-side machine learning and deep learning for advisory pattern recognition, anomaly detection and recovery-risk predictions.'}),
    intelligenceStatusTool,intelligenceInsightsTool,mlProjectCodingTool,calculatorTool,statisticsTool,probabilityTool,
    knowledgeSearchTool,memorySearchTool,recordSearchTool,patternTool,mtsOverviewTool,mtsListTool,mtsTraceTool
  ],
  modelSettings:{reasoning:{effort:'high',summary:'auto',context:'all_turns'},text:{verbosity:'medium'},store:true}
});

function formatInterruptions(result){
  return (result.interruptions||[]).map((x,index)=>({index,agent:x.agent?.name||'',tool:x.name||'',arguments:x.arguments||''}));
}

export async function runAgentWorkflow({message,sessionId='default',userContext={},activityRunId=''}){
  const runId=await beginAgentActivityRun({runId:activityRunId,actorId:userContext?.id||'',sessionId,message});
  if(!process.env.OPENAI_API_KEY){
    await pushAgentActivity({runId,actorId:userContext?.id||'',phase:'error',view:'assistant',selector:'[data-view="assistant"]',label:'Large language model connection is not configured',status:'error'});
    await completeAgentActivityRun(runId,{status:'error',label:'LLM connection required'});
    return {mode:'LLM_NOT_CONFIGURED',output_text:'OpenAI API access is not configured. Set a valid OPENAI_API_KEY in the deployment environment. Agent tasks require the OpenAI API and will not fall back to a local model or canned response.',requires_approval:false,session_id:sessionId,activity_run_id:runId,llm_configured:false};
  }
  return withTrace('ADRA Recovery Intelligent Memory Agent',async()=>{
    try{
      await pushAgentActivity({runId,actorId:userContext?.id||'',phase:'reasoning',view:'assistant',selector:'#chatMessages',label:'Reasoning over the request, conversation memory and live system evidence',status:'working'});
      const grounding=await buildGrounding(message,sessionId,userContext);
      const context={sessionId,grounding,userContext,userMessage:message,activityRunId:runId};
      const session=new PersistentSession(sessionId);
      const result=await runner.run(manager,message,{session,context,maxTurns:32,toolExecution:{preApprovalInputGuardrails:true}});
      if(result.interruptions?.length){
        await completeAgentActivityRun(runId,{status:'paused',label:'Waiting for a required controlled approval'});
        return {mode:'OpenAI Agents SDK',output_text:'A controlled system action still requires explicit review before it can continue.',requires_approval:true,approvals:formatInterruptions(result),approval_state:result.state.toString(),session_id:sessionId,activity_run_id:runId,llm_configured:true};
      }
      if(!result.finalOutput)throw new Error('Agent result is undefined.');
      await completeAgentActivityRun(runId,{status:'completed',label:'Command completed'});
      const activity=await listAgentActivity({runId,after:0,limit:300});
      const executed=(activity.events||[]).filter(e=>e.phase==='result'&&e.status==='completed').map(e=>({view:e.view,panel:e.panel,label:e.label,metadata:e.metadata||{}}));
      return {mode:'OpenAI Agents SDK + Persistent Memory + Task Execution',output_text:String(result.finalOutput),requires_approval:false,session_id:sessionId,activity_run_id:runId,llm_configured:true,executed_actions:executed};
    }catch(error){
      await pushAgentActivity({runId,actorId:userContext?.id||'',phase:'error',view:'assistant',selector:'#chatMessages',label:error.message||'Agent execution failed',status:'error'}).catch(()=>{});
      await completeAgentActivityRun(runId,{status:'error',label:'Command could not be completed'}).catch(()=>{});
      throw error;
    }
  });
}

export async function resumeAgentWorkflow({approvalState,decisions=[],sessionId='default'}){
  if(!process.env.OPENAI_API_KEY)throw new Error('OPENAI_API_KEY is required to resume an Agents SDK approval.');
  return withTrace('ADRA Recovery Agent Approval Resume',async()=>{
    const state=await RunState.fromString(manager,approvalState); const interruptions=state.getInterruptions();
    for(let i=0;i<interruptions.length;i++){const decision=decisions[i];if(decision===undefined)continue;if(decision===true)state.approve(interruptions[i]);else state.reject(interruptions[i],{message:'The user rejected this system change.'});}
    const session=new PersistentSession(sessionId); const result=await runner.run(manager,state,{session,maxTurns:20,toolExecution:{preApprovalInputGuardrails:true}});
    if(result.interruptions?.length)return {mode:'OpenAI Agents SDK',output_text:'Another system change requires approval.',requires_approval:true,approvals:formatInterruptions(result),approval_state:result.state.toString(),session_id:sessionId};
    if(!result.finalOutput)throw new Error('Agent result is undefined after approval.');
    return {mode:'OpenAI Agents SDK + Persistent Memory',output_text:String(result.finalOutput),requires_approval:false,session_id:sessionId};
  });
}
