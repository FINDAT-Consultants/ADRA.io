import { createHash } from 'node:crypto';
import { Agent, Runner, withTrace } from '@openai/agents';
import { z } from 'zod';
import { engine } from './engine-runtime.js';
import { getControlProfile, listControlReviews } from './control-center-store.js';
import { listRecords } from './record-store.js';
import { getMtsOverview } from './mts-store.js';
import { getLiveIntelligenceInsights, getIntelligenceStatus } from './intelligence-engine.js';
import { runAgentWorkflow, resumeAgentWorkflow } from './agents.js';
import { getBrainThread, appendBrainMessage, markBrainMessageRead, getUnreadBrainMessages, updateBrainSignalState, reconcileBrainNotifications, clearBrainConversation, getBrainStatus, recordBrainLearning, getBrainLearningProfile } from './brain-store.js';

const MODEL=process.env.OPENAI_MODEL||'gpt-5.6';
const advisorRunner=new Runner({traceMetadata:{trace_source:'adra-system-brain',workflow_id:'proactive-human-like-advisor'}});
const proactiveAdvisor=new Agent({
  name:'ADRA AI Advisor',model:MODEL,
  instructions:`You are the proactive reasoning advisor inside the ADRA Recovery Passport System. You are software, not a human employee, but write naturally like a careful, experienced colleague. Use only the supplied live-system facts. Think through cause, consequence, priority and a practical next step. Never fabricate a person, event, amount, approval, document, status or completed action. If evidence is incomplete, say what is missing. Separate a fact from an inference when that distinction matters. Keep financial authority with deterministic controls and assigned human reviewers. Do not execute tools or claim an action was taken. If the supplied signals do not justify interrupting the user, output exactly NO_ADVICE. Otherwise write a concise message suitable for an internal notification: what needs attention, why it matters, and what the user should do next.`,
  modelSettings:{reasoning:{effort:'high',summary:'auto'},text:{verbosity:'medium'},store:true}
});

const continuationSchema=z.object({
  predictions:z.array(z.object({text:z.string().min(1).max(80),probability:z.number().min(0).max(1)})).min(1).max(4)
});
const continuationPredictor=new Agent({
  name:'ADRA Predictive Compose',model:MODEL,
  instructions:`Predict a few plausible short continuations for the user's unfinished message using only the supplied conversation context and current text. Return 2-4 continuations, normally 1-8 words each. Probabilities are ESTIMATED RELATIVE LIKELIHOODS for the listed alternatives, not calibrated token log-probabilities. They should sum approximately to 1. Do not complete sensitive or unsafe requests. Do not invent system facts. Prefer continuations that fit the user's writing style and the current ADRA Recovery Passport conversation.`,
  outputType:continuationSchema,
  modelSettings:{reasoning:{effort:'low'},text:{verbosity:'low'},store:false}
});

const clean=v=>String(v??'').trim();
const normalize=v=>String(v??'').trim().toLowerCase();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
let scanTimer=null;
let scanRunning=false;

async function actorFor(actorId){const p=await getControlProfile();return p.users?.find(u=>u.id===clean(actorId))||p.currentUser||null;}
function assignedTask(task,actor){const ids=new Set([actor?.id,actor?.name,actor?.email].filter(Boolean).map(normalize));const a=normalize(task.metadata?.assigned_to||task.metadata?.assignee||'');return !a||ids.has(a)||['Administrator','Developer'].includes(actor?.role);}

export async function collectBrainSignals(actorId){
  const actor=await actorFor(actorId);if(!actor)return {actor:null,signals:[]};
  const [reviews,records,mts,intel]=await Promise.all([listControlReviews({actorId:actor.id}),listRecords({limit:250,recordType:'task'}),getMtsOverview({}),Promise.resolve(getLiveIntelligenceInsights())]);
  const tasks=records.filter(t=>['active','pending','open'].includes(normalize(t.status||'active'))).filter(t=>assignedTask(t,actor));
  const signals=[];
  for(const r of reviews.slice(0,20))signals.push({id:`review:${r.id}`,type:'REVIEW',priority:r.kind==='CONTROL_BLOCK'?'high':'normal',title:r.title,detail:r.detail,status:r.status,kind:r.kind});
  for(const t of tasks.slice(0,15))signals.push({id:`task:${t.id}`,type:'TASK',priority:'normal',title:t.title,detail:t.content,status:t.status});
  if(['Administrator','Developer'].includes(actor.role)||actor.canReview){
    for(const m of engine.monthlyEngine().filter(x=>x.postingStatus!=='READY TO POST').slice(0,12))signals.push({id:`month:${m.month}`,type:'RECOVERY_BLOCK',priority:Number(m.criticalExceptions||0)>0?'high':'normal',title:`${m.monthLabel} recovery is ${m.postingStatus}`,detail:`${Number(m.criticalExceptions||0)} critical exception(s); readiness ${Math.round(Number(m.readinessScore||0)*100)}%.`,status:m.postingStatus});
  }
  if(['LIVE_LEARNING','LIVE_MATURE'].includes(intel.quality)){
    for(const a of (intel.anomalies||[]).slice(0,8))signals.push({id:`anomaly:${a.id}`,type:'ADAPTIVE_SIGNAL',priority:a.anomalyScore>=5?'high':'normal',title:'Unusual time-entry pattern',detail:`${a.employeeId||'Employee'} · ${a.projectCode||'Project'} · ${a.hours} hours · anomaly score ${Number(a.anomalyScore||0).toFixed(1)}.`,status:'ADVISORY'});
    for(const r of (intel.monthlyRisk||[]).filter(x=>Number(x.riskProbability||0)>=.65).slice(0,8))signals.push({id:`risk:${r.month}`,type:'RECOVERY_RISK',priority:Number(r.riskProbability)>=.8?'high':'normal',title:`Elevated recovery risk for ${r.monthLabel||r.month}`,detail:`Advisory risk probability ${Math.round(Number(r.riskProbability||0)*100)}%; deterministic status ${r.postingStatus}.`,status:'ADVISORY'});
  }
  for(const o of (mts.overtime||[]).slice(0,8))signals.push({id:`overtime:${o.id||o.employee_id||o.employee_name}:${o.date||''}`,type:'WORK_ACTIVITY',priority:'normal',title:'Work activity requires attention',detail:`${o.employee_name||o.employee_id||'Employee'} · ${o.hours||o.duration_hours||''} hours${o.project_code?` · ${o.project_code}`:''}.`,status:'ADVISORY'});
  return {actor,signals,context:{live:{employees:engine.state.employees.length,projects:engine.state.projects.length,timeEntries:engine.state.timeEntries.length,payrollRows:engine.state.payroll.length},work:{active:mts.active_sessions||0,completed:mts.completed_sessions||0,totalHours:mts.total_hours||0},intelligence:getIntelligenceStatus()}};
}


export async function scanSystemBrain({actorId='',reason='system-change',force=false}={}){
  const {actor,signals,context}=await collectBrainSignals(actorId);if(!actor)return {created:false,reason:'no-actor'};
  await reconcileBrainNotifications(actor.id,signals.map(x=>x.id));
  if(!signals.length){await updateBrainSignalState(actor.id,{signalHash:'',signalAt:new Date().toISOString()});return {created:false,reason:'no-actionable-signals'};}
  const signature=hash(signals.map(x=>({id:x.id,status:x.status,detail:x.detail})).sort((a,b)=>a.id.localeCompare(b.id)));
  const thread=await getBrainThread(actor.id,{limit:5});
  await updateBrainSignalState(actor.id,{signalAt:new Date().toISOString()});
  if(!force&&thread.lastSignalHash===signature)return {created:false,reason:'unchanged-signals',signalHash:signature};
  let text;
  if(process.env.OPENAI_API_KEY){
    const input=`Current user: ${actor.name} (${actor.role}).\nReason for this check: ${reason}.\nLive context:\n${JSON.stringify(context,null,2)}\nPending signals:\n${JSON.stringify(signals,null,2)}\nDecide whether an internal advisory notification is warranted now.`;
    try{const result=await withTrace('ADRA proactive system reasoning',()=>advisorRunner.run(proactiveAdvisor,input,{maxTurns:3}));text=clean(result.finalOutput);}catch(err){console.error('Proactive advisor failed:',err.message);return {created:false,reason:'llm-error',error:err.message,signalHash:signature};}
  }else return {created:false,reason:'llm-not-configured',signalHash:signature};
  if(!text||text==='NO_ADVICE'){await updateBrainSignalState(actor.id,{signalHash:signature,signalAt:new Date().toISOString()});return {created:false,reason:'advisor-declined',signalHash:signature};}
  const row=await appendBrainMessage(actor.id,{role:'assistant',sender:'Recovery Agent',content:text,source:'proactive',read:false,signalHash:signature,metadata:{reason,signalIds:signals.map(x=>x.id),signalCount:signals.length}});
  return {created:true,message:row,signalHash:signature};
}


async function ensureBrainReadyNotification(actorId){
  if(!process.env.OPENAI_API_KEY)return {created:false,reason:'llm-not-configured'};
  const t=await getBrainThread(actorId,{limit:400});
  if((t.messages||[]).some(m=>m.source==='system_ready'))return {created:false,reason:'already-created'};
  const row=await appendBrainMessage(actorId,{role:'assistant',sender:'Recovery Agent',content:`The Recovery Agent is configured for ${MODEL} reasoning and task execution. I am monitoring your assigned reviews, pending tasks, recovery blockers and work-activity signals. You can reply to this notification or give me a command in Recovery Agent; supported actions will be carried out with your signed-in permissions.`,source:'system_ready',read:true,metadata:{kind:'LLM_READY'}});
  return {created:true,message:row};
}

export function scheduleSystemBrainScan({reason='system-change',delay=900}={}){
  clearTimeout(scanTimer);scanTimer=setTimeout(async()=>{if(scanRunning)return;scanRunning=true;try{const p=await getControlProfile();for(const u of (p.users||[]).filter(x=>x.active!==false)){if(reason==='startup')await ensureBrainReadyNotification(u.id);await scanSystemBrain({actorId:u.id,reason});}}catch(err){console.error('System brain scan failed:',err.message);}finally{scanRunning=false;}},Math.max(100,Number(delay)||900));
}

export function startSystemBrainMonitor({intervalMs=45000}={}){
  const timer=setInterval(()=>scheduleSystemBrainScan({reason:'periodic-monitor',delay:100}),Math.max(15000,Number(intervalMs)||45000));
  timer.unref?.();return timer;
}

export async function chatWithSystemBrain({actorId='',message,runId=''}={}){
  const actor=await actorFor(actorId);if(!actor)throw new Error('A signed-in application user is required.');const text=clean(message);if(!text)throw new Error('Message is required.');
  const thread=await getBrainThread(actor.id,{limit:300}),adaptiveLearning=await getBrainLearningProfile(actor.id);await appendBrainMessage(actor.id,{role:'user',sender:actor.name||actor.id,content:text,source:'conversation',read:true});
  const result=await runAgentWorkflow({message:text,sessionId:thread.sessionId,userContext:{id:actor.id,name:actor.name,role:actor.role,email:actor.email||'',canReview:Boolean(actor.canReview),canManageSettings:Boolean(actor.canManageSettings),adaptiveLearning},activityRunId:runId});
  await appendBrainMessage(actor.id,{role:'assistant',sender:'Recovery Agent',content:result.output_text||'No response.',source:result.requires_approval?'approval_pause':'conversation',read:true,metadata:{requiresApproval:Boolean(result.requires_approval),activityRunId:result.activity_run_id||''}});
  const actions=Array.isArray(result.executed_actions)?result.executed_actions:[];
  await recordBrainLearning(actor.id,{message:text,executedActions:actions});
  if(actions.length){
    const labels=[...new Set(actions.map(a=>clean(a.label).replace(/^Completed:\s*/i,'')).filter(Boolean))].slice(0,5);
    const note=`I completed ${labels.length===1?'the requested action':'the requested actions'}: ${labels.join('; ')}. The live interface has been refreshed. You can reply here if you want me to verify the result or continue with the next step.`;
    await appendBrainMessage(actor.id,{role:'assistant',sender:'Recovery Agent',content:note,source:'task_completion',read:false,metadata:{activityRunId:result.activity_run_id||'',actionCount:actions.length}});
    scheduleSystemBrainScan({reason:'agent-task-completed',delay:300});
  }
  return {...result,actor_id:actor.id,brain_session_id:thread.sessionId};
}

export async function resumeSystemBrain({actorId='',approvalState,decisions=[]}={}){
  const actor=await actorFor(actorId);if(!actor)throw new Error('A signed-in application user is required.');const thread=await getBrainThread(actor.id,{limit:20});const result=await resumeAgentWorkflow({approvalState,decisions,sessionId:thread.sessionId});
  await appendBrainMessage(actor.id,{role:'assistant',sender:'Recovery Agent',content:result.output_text||'Action review completed.',source:result.requires_approval?'approval_pause':'conversation',read:true,metadata:{requiresApproval:Boolean(result.requires_approval)}});return {...result,actor_id:actor.id,brain_session_id:thread.sessionId};
}

export async function predictSystemBrainContinuation({actorId='',text}={}){
  const actor=await actorFor(actorId);if(!actor)throw new Error('A signed-in application user is required.');const inputText=clean(text);if(inputText.length<3)return {available:Boolean(process.env.OPENAI_API_KEY),predictions:[],kind:'estimated_relative_probability'};
  if(!process.env.OPENAI_API_KEY)return {available:false,predictions:[],kind:'estimated_relative_probability',note:'OPENAI_API_KEY is required for predictive compose.'};
  const thread=await getBrainThread(actor.id,{limit:24});
  const history=(thread.messages||[]).slice(-12).map(m=>`${m.role==='user'?'User':'AI'}: ${m.content}`).join('\n');
  const prompt=`Current user: ${actor.name||actor.id}.
Recent conversation:
${history||'(no prior messages)'}

Unfinished user text:
${inputText}

Predict short likely continuations only.`;
  const result=await advisorRunner.run(continuationPredictor,prompt,{maxTurns:2});
  const raw=Array.isArray(result.finalOutput?.predictions)?result.finalOutput.predictions:[];
  const trimmed=raw.map(x=>({text:clean(x.text).replace(/^\s+/,''),probability:Math.max(0,Math.min(1,Number(x.probability)||0))})).filter(x=>x.text).slice(0,4);
  const total=trimmed.reduce((s,x)=>s+x.probability,0);const predictions=trimmed.map(x=>({...x,probability:total>0?x.probability/total:1/Math.max(trimmed.length,1)}));
  return {available:true,predictions,kind:'estimated_relative_probability',note:'Probabilities are model-estimated relative likelihoods, not calibrated token log-probabilities.'};
}

export async function getSystemBrainThread(actorId,{limit=120}={}){return getBrainThread(actorId,{limit});}
export async function readSystemBrainMessage(actorId,id){return markBrainMessageRead(actorId,id);}
export async function unreadSystemBrainMessages(actorId,{limit=100}={}){return getUnreadBrainMessages(actorId,{limit});}
export async function clearSystemBrain(actorId,{startNew=true}={}){return clearBrainConversation(actorId,{startNew});}
export async function systemBrainStatus(actorId){const configured=Boolean(process.env.OPENAI_API_KEY);return {...await getBrainStatus(actorId),openaiConfigured:configured,model:MODEL,reasoningMode:configured?'OPENAI_AGENTS_SDK_LLM':'LLM_NOT_CONFIGURED',proactiveAdvice:configured,contextAwareConversation:true,causalReasoning:true,deterministicMath:true,probabilisticReasoning:true,predictiveCompose:configured,adaptiveInteractionLearning:true,taskExecution:true,visibleUiActivity:true,humanApprovalBoundary:true};}
