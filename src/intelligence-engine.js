import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine } from './engine-runtime.js';
import { createServerSupabase, hasSupabaseConfig, readAppState, writeAppState } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MODEL_FILE = path.join(ROOT, 'data', 'ml-models.json');
const TRAINING_FILE = path.join(ROOT, 'data', 'training', 'workbook-demo-reference.json');
const LEARNING_FILE = path.join(ROOT, 'data', 'agent-learning.json');

const EPS = 1e-9;
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, Number(v) || 0));
const clean = v => String(v ?? '').trim();
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
const relu = x => Math.max(0, x);
const reluGrad = x => x > 0 ? 1 : 0;
const now = () => new Date().toISOString();

let state = null;
let refreshTimer = null;
let trainingPromise = null;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

function seededRandom(seed=1337) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function parseSheetRows(sheet=[]) {
  if (!Array.isArray(sheet)) return [];
  let headerIndex = -1;
  for (let i=0;i<sheet.length;i++) {
    const row = sheet[i];
    if (Array.isArray(row) && row.filter(Boolean).length >= 3) {
      const text = row.map(x=>clean(x).toLowerCase());
      if (text.includes('entry id') || text.includes('month') && text.includes('posting status')) { headerIndex=i; break; }
    }
  }
  if (headerIndex < 0) return [];
  const headers = sheet[headerIndex].map((x,i)=>clean(x)||`column_${i}`);
  return sheet.slice(headerIndex+1).filter(r=>Array.isArray(r)&&r.some(x=>x!==null&&x!==undefined&&x!=='')).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
}

function textTokens(value) {
  return clean(value).toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) || [];
}

function trainNaiveBayes(examples=[]) {
  const classDocs = {}, tokenCounts = {}, vocabulary = new Set();
  let totalDocs=0;
  for (const ex of examples) {
    const label=clean(ex.label), text=clean(ex.text); if(!label||!text)continue;
    const weight=Math.max(1, Math.min(25, Number(ex.weight||1)));
    classDocs[label]=(classDocs[label]||0)+weight; totalDocs+=weight;
    tokenCounts[label] ||= {total:0,tokens:{}};
    for(const token of textTokens(text)) {
      vocabulary.add(token); tokenCounts[label].tokens[token]=(tokenCounts[label].tokens[token]||0)+weight; tokenCounts[label].total+=weight;
    }
  }
  return {type:'multinomial_naive_bayes',classDocs,tokenCounts,vocabulary:[...vocabulary],totalDocs};
}

function predictNaiveBayes(model,text,limit=5) {
  if(!model?.totalDocs)return [];
  const vocabSize=Math.max(1,model.vocabulary?.length||0),tokens=textTokens(text),classes=Object.keys(model.classDocs||{});
  const scores=classes.map(label=>{
    let logp=Math.log((model.classDocs[label]+1)/(model.totalDocs+classes.length));
    const tc=model.tokenCounts[label]||{total:0,tokens:{}};
    for(const token of tokens)logp+=Math.log(((tc.tokens[token]||0)+1)/(tc.total+vocabSize));
    return {label,logp};
  });
  const max=Math.max(...scores.map(x=>x.logp));const probs=scores.map(x=>({...x,p:Math.exp(x.logp-max)}));const sum=probs.reduce((a,x)=>a+x.p,0)||1;
  return probs.map(x=>({label:x.label,confidence:x.p/sum})).sort((a,b)=>b.confidence-a.confidence).slice(0,limit);
}

function standardizeRows(rows) {
  if(!rows.length)return {rows:[],mean:[],std:[]};
  const d=rows[0].x.length,mean=Array(d).fill(0),std=Array(d).fill(0);
  for(const r of rows)for(let j=0;j<d;j++)mean[j]+=Number(r.x[j]||0);for(let j=0;j<d;j++)mean[j]/=rows.length;
  for(const r of rows)for(let j=0;j<d;j++)std[j]+=(Number(r.x[j]||0)-mean[j])**2;for(let j=0;j<d;j++)std[j]=Math.sqrt(std[j]/rows.length)||1;
  return {rows:rows.map(r=>({...r,x:r.x.map((v,j)=>(Number(v||0)-mean[j])/std[j])})),mean,std};
}

function trainLogistic(rows,{epochs=700,lr=.055,l2=.002}={}) {
  if(!rows.length)return null;
  const norm=standardizeRows(rows),d=rows[0].x.length,w=Array(d).fill(0),labels=rows.map(r=>r.y),pos=labels.reduce((a,b)=>a+b,0),neg=labels.length-pos,posWeight=pos?Math.max(1,neg/pos):1;
  let b=0;
  for(let epoch=0;epoch<epochs;epoch++){
    const gw=Array(d).fill(0);let gb=0;
    for(const r of norm.rows){const z=w.reduce((a,v,j)=>a+v*r.x[j],b),p=sigmoid(z),weight=r.y?posWeight:1,e=(p-r.y)*weight;for(let j=0;j<d;j++)gw[j]+=e*r.x[j];gb+=e;}
    for(let j=0;j<d;j++)w[j]-=lr*((gw[j]/rows.length)+l2*w[j]);b-=lr*(gb/rows.length);
  }
  return {type:'logistic_regression',weights:w,bias:b,mean:norm.mean,std:norm.std,trainingRows:rows.length};
}
function predictLogistic(model,x){if(!model)return .5;const z=model.weights.reduce((a,w,j)=>a+w*((Number(x[j]||0)-model.mean[j])/(model.std[j]||1)),model.bias);return sigmoid(z);}

function initMatrix(rows,cols,rand,scale=.22){return Array.from({length:rows},()=>Array.from({length:cols},()=>((rand()*2)-1)*scale));}
function trainMlp(rows,{epochs=1100,lr=.025,l2=.0006,seed=1701}={}) {
  if(!rows.length)return null;
  const norm=standardizeRows(rows),input=rows[0].x.length,h1=12,h2=6,rand=seededRandom(seed);
  const W1=initMatrix(h1,input,rand),b1=Array(h1).fill(0),W2=initMatrix(h2,h1,rand),b2=Array(h2).fill(0),W3=initMatrix(1,h2,rand),b3=[0];
  const labels=rows.map(r=>r.y),pos=labels.reduce((a,b)=>a+b,0),neg=labels.length-pos,posWeight=pos?Math.max(1,neg/pos):1;
  for(let epoch=0;epoch<epochs;epoch++){
    for(const r of norm.rows){
      const z1=W1.map((row,i)=>row.reduce((a,w,j)=>a+w*r.x[j],b1[i])),a1=z1.map(relu);
      const z2=W2.map((row,i)=>row.reduce((a,w,j)=>a+w*a1[j],b2[i])),a2=z2.map(relu);
      const z3=W3[0].reduce((a,w,j)=>a+w*a2[j],b3[0]),p=sigmoid(z3),weight=r.y?posWeight:1,d3=(p-r.y)*weight;
      const d2=a2.map((_,j)=>W3[0][j]*d3*reluGrad(z2[j]));
      const d1=a1.map((_,j)=>W2.reduce((a,row,k)=>a+row[j]*d2[k],0)*reluGrad(z1[j]));
      for(let j=0;j<h2;j++)W3[0][j]-=lr*(d3*a2[j]+l2*W3[0][j]);b3[0]-=lr*d3;
      for(let i=0;i<h2;i++){for(let j=0;j<h1;j++)W2[i][j]-=lr*(d2[i]*a1[j]+l2*W2[i][j]);b2[i]-=lr*d2[i];}
      for(let i=0;i<h1;i++){for(let j=0;j<input;j++)W1[i][j]-=lr*(d1[i]*r.x[j]+l2*W1[i][j]);b1[i]-=lr*d1[i];}
    }
  }
  return {type:'deep_mlp',architecture:[input,h1,h2,1],W1,b1,W2,b2,W3,b3,mean:norm.mean,std:norm.std,trainingRows:rows.length};
}
function predictMlp(model,x){if(!model)return .5;const nx=x.map((v,j)=>(Number(v||0)-model.mean[j])/(model.std[j]||1)),a1=model.W1.map((row,i)=>relu(row.reduce((a,w,j)=>a+w*nx[j],model.b1[i]))),a2=model.W2.map((row,i)=>relu(row.reduce((a,w,j)=>a+w*a1[j],model.b2[i]))),z=model.W3[0].reduce((a,w,j)=>a+w*a2[j],model.b3[0]);return sigmoid(z);}

function monthlyFeatures(row={}) {
  const expected=Math.max(1,Number(row.expectedHours||row['Expected Hours']||0));
  return [
    clamp(row.completeness??row['Completeness']),
    clamp(row.dailyReconciliation??row['Daily Reconciliation']),
    clamp(row.eligibility??row['Eligibility']),
    clamp(row.timeliness??row['Timeliness']),
    clamp(row.approval??row['Approval']),
    Math.min(2,Math.abs(Number((row.hoursVariance??row['Hours Variance'])||0))/expected),
    clamp(row.recoveryRate??row['Recovery Rate']),
    Math.min(1,Number((row.criticalExceptions??row['Critical Exceptions'])||0)/5)
  ];
}

function archiveExamples(archive) {
  const workbook=archive?.workbook_data||{};
  const time=parseSheetRows(workbook['Time Entry']);
  const monthly=parseSheetRows(workbook['Monthly Engine']);
  const coding=time.filter(r=>clean(r['Project Code'])&&clean(r['Activity / Evidence'])).map(r=>({text:r['Activity / Evidence'],label:r['Project Code'],weight:clean(r['Employee Decision']).toLowerCase()==='accepted'?2:1,source:'TRAINING_REFERENCE'}));
  const recovery=monthly.filter(r=>clean(r['Posting Status'])).map(r=>({x:monthlyFeatures(r),y:clean(r['Posting Status']).toUpperCase()==='READY TO POST'?1:0,source:'TRAINING_REFERENCE'}));
  return {coding,recovery};
}

function liveExamples() {
  const coding=(engine.state.timeEntries||[]).filter(r=>clean(r.activity)&&clean(r.projectCode)&&['accepted','finance approved','supervisor approved'].includes(clean(r.employeeDecision||r.status).toLowerCase())).map(r=>({text:r.activity,label:r.projectCode,weight:clean(r.status).toLowerCase()==='finance approved'?6:3,source:'LIVE_CONFIRMED'}));
  const recovery=(engine.monthlyEngine?.()||[]).filter(r=>r&&clean(r.postingStatus)).map(r=>({x:monthlyFeatures(r),y:clean(r.postingStatus).toUpperCase()==='READY TO POST'?1:0,source:'LIVE_DETERMINISTIC'}));
  return {coding,recovery};
}

async function confirmedMappingExamples() {
  let rows=[];
  if(hasSupabaseConfig()){
    const {data,error}=await createServerSupabase().from('agent_learning_mappings').select('*').order('last_confirmed_at',{ascending:false});
    if(error)throw error; rows=data||[];
  }else rows=await readJson(LEARNING_FILE,[]);
  return (Array.isArray(rows)?rows:[]).filter(r=>clean(r.activity_example||r.activity_key)&&clean(r.project_code)).map(r=>({text:r.activity_example||r.activity_key,label:r.project_code,weight:Math.min(25,4+Number(r.accepted_count||1)*3),source:'HUMAN_CONFIRMED_MAPPING'}));
}

function qualityLabel(liveCount,total) {
  if(liveCount>=100)return 'LIVE_MATURE';
  if(liveCount>=30)return 'LIVE_LEARNING';
  if(liveCount>=10)return 'EARLY_LIVE';
  if(total)return 'REFERENCE_COLD_START';
  return 'NO_TRAINING_DATA';
}

export async function trainIntelligenceModels({reason='manual'}={}) {
  if(trainingPromise)return trainingPromise;
  trainingPromise=(async()=>{
    const archive=await readJson(TRAINING_FILE,{}),arch=archiveExamples(archive),live=liveExamples(),confirmed=await confirmedMappingExamples();
    const codingExamples=[...arch.coding,...confirmed,...live.coding],recoveryRows=[...arch.recovery,...live.recovery];
    const bayes=trainNaiveBayes(codingExamples),logistic=trainLogistic(recoveryRows),deep=trainMlp(recoveryRows);
    const liveTrainingRows=live.coding.length+live.recovery.length+confirmed.length;
    state={
      version:2,updatedAt:now(),lastTrainingReason:reason,
      boundaries:{financialAuthority:'DETERMINISTIC_ENGINE_AND_HUMAN_APPROVAL_ONLY',historicalData:'TRAINING_REFERENCE_ONLY',openAI:'INFERENCE_AND_AGENT_REASONING_NOT_SILENT_RETRAINING'},
      featureStore:{archiveCodingRows:arch.coding.length,archiveRecoveryRows:arch.recovery.length,humanConfirmedMappings:confirmed.length,liveCodingRows:live.coding.length,liveRecoveryRows:live.recovery.length,totalTrainingRows:codingExamples.length+recoveryRows.length},
      quality:qualityLabel(liveTrainingRows,codingExamples.length+recoveryRows.length),
      models:{projectCoding:bayes,recoveryLogistic:logistic,recoveryDeepNetwork:deep,anomalyModel:{type:'adaptive_robust_zscore',minimumLiveRows:8}},
      metrics:{projectClasses:Object.keys(bayes.classDocs||{}).length,recoveryPositiveRows:recoveryRows.filter(r=>r.y===1).length,recoveryNegativeRows:recoveryRows.filter(r=>r.y===0).length,deepArchitecture:deep?.architecture||[]}
    };
    await writeAppState('ml_models',state);
    return getIntelligenceStatus();
  })();
  try{return await trainingPromise;}finally{trainingPromise=null;}
}

export function scheduleIntelligenceRefresh({reason='live-data-change',delay=650}={}) {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{trainIntelligenceModels({reason}).catch(err=>console.error('Intelligence refresh failed:',err.message));},delay);
}

export async function initializeIntelligence() {
  const local=await readJson(MODEL_FILE,null);
  state=await readAppState('ml_models',local,{seedIfMissing:true});
  return trainIntelligenceModels({reason:'startup'});
}

function anomalyRows() {
  const rows=(engine.state.timeEntries||[]).map(r=>({id:r.entryId,date:r.date,employeeId:r.employeeId,projectCode:r.projectCode,hours:Number(r.hours||0),activity:r.activity||''})).filter(r=>r.hours>0);
  if(rows.length<8)return [];
  const vals=rows.map(r=>r.hours).sort((a,b)=>a-b),median=vals[Math.floor(vals.length/2)],dev=vals.map(v=>Math.abs(v-median)).sort((a,b)=>a-b),mad=dev[Math.floor(dev.length/2)]||1;
  return rows.map(r=>({...r,anomalyScore:Math.abs(r.hours-median)/(1.4826*mad)})).filter(r=>r.anomalyScore>=3.5).sort((a,b)=>b.anomalyScore-a.anomalyScore).slice(0,25);
}

export function predictProjectCoding(activity,{limit=5}={}) {
  const predictions=predictNaiveBayes(state?.models?.projectCoding,activity,limit);
  const mature=state?.quality==='LIVE_MATURE'||state?.quality==='LIVE_LEARNING';
  return predictions.map(x=>({...x,confidence:Math.round(x.confidence*1000)/1000,advisory:true,quality:state?.quality||'UNINITIALIZED',humanConfirmationRequired:true,confidenceBand:x.confidence>=.75&&mature?'HIGH':x.confidence>=.5?'MEDIUM':'LOW'}));
}

export function predictRecoveryRisk(row={}) {
  const x=monthlyFeatures(row),pLog=predictLogistic(state?.models?.recoveryLogistic,x),pDeep=predictMlp(state?.models?.recoveryDeepNetwork,x),readyProbability=clamp(.42*pLog+.58*pDeep),risk=1-readyProbability;
  return {readyProbability:Math.round(readyProbability*1000)/1000,riskProbability:Math.round(risk*1000)/1000,deepProbability:Math.round(pDeep*1000)/1000,mlProbability:Math.round(pLog*1000)/1000,quality:state?.quality||'UNINITIALIZED',advisory:true,financialAuthority:false};
}

export function getLiveIntelligenceInsights() {
  const monthly=(engine.monthlyEngine?.()||[]).map(row=>({month:row.month,monthLabel:row.monthLabel,postingStatus:row.postingStatus,criticalExceptions:row.criticalExceptions,...predictRecoveryRisk(row)}));
  return {generatedAt:now(),quality:state?.quality||'UNINITIALIZED',monthlyRisk:monthly,anomalies:anomalyRows(),boundaries:state?.boundaries||{}};
}

export function getIntelligenceStatus() {
  return {
    enabled:true,
    updatedAt:state?.updatedAt||null,
    lastTrainingReason:state?.lastTrainingReason||null,
    quality:state?.quality||'UNINITIALIZED',
    featureStore:state?.featureStore||{},
    metrics:state?.metrics||{},
    models:{
      machineLearning:['Multinomial Naive Bayes project-coding classifier','Regularized logistic recovery-risk classifier','Adaptive robust anomaly detector'],
      deepLearning:['Server-side 8→12→6→1 neural network for recovery-risk pattern learning','OpenAI Agents SDK model reasoning when OPENAI_API_KEY is configured']
    },
    openai:{configured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-5.6',keyLocation:process.env.OPENAI_API_KEY?'SUPABASE_VAULT_OR_SERVER_ENVIRONMENT':'NOT_CONFIGURED'},
    boundaries:state?.boundaries||{}
  };
}
