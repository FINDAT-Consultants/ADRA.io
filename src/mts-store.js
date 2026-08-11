import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine } from './engine-runtime.js';
import { createServerSupabase, hasSupabaseConfig } from './supabase.js';
import { addDraftTimeEntry } from './operational-store.js';
import { logAction } from './record-store.js';
import { ensureLiveContextFromWorkSessions } from './live-data-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'mts-runtime.json');

const nowIso = () => new Date().toISOString();
const uid = (prefix='MTS') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const clean = (v) => String(v ?? '').trim();
const clamp = (n,min,max) => Math.min(max,Math.max(min,Number(n)||0));

async function readLocal() {
  try {
    const value = JSON.parse(await fs.readFile(FILE, 'utf8'));
    return { sessions: Array.isArray(value.sessions) ? value.sessions : [], messages: Array.isArray(value.messages) ? value.messages : [] };
  } catch {
    return { sessions: [], messages: [] };
  }
}
async function writeLocal(value) {
  await fs.writeFile(FILE, JSON.stringify(value, null, 2));
}

function durationHours(start, end) {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round(((b-a)/3_600_000) * 1_000_000) / 1_000_000;
}

function parseLegacyHours(record) {
  const fromTimestamps = durationHours(record.clockInTimestamp, record.clockOutTimestamp);
  if (fromTimestamps > 0) return fromTimestamps;
  const value = clean(record.totalHours).toLowerCase();
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  if (value.includes('hr')) return n;
  if (value.includes('min')) return n/60;
  if (value.includes('sec')) return n/3600;
  return n;
}

function isoFromLegacy(date, displayTime, timestamp) {
  if (timestamp && Number.isFinite(Number(timestamp))) return new Date(Number(timestamp)).toISOString();
  if (!date) return null;
  if (!displayTime) return new Date(`${date}T08:00:00`).toISOString();
  const parsed = new Date(`${date} ${displayTime}`);
  return Number.isNaN(parsed.getTime()) ? new Date(`${date}T08:00:00`).toISOString() : parsed.toISOString();
}

export function normalizeLegacyMtsRecord(record, index=0) {
  if (record && (record.activity_description != null || record.clock_in_at != null || record.employee_id != null)) {
    const clockInAt = record.clock_in_at && !Number.isNaN(new Date(record.clock_in_at).getTime()) ? new Date(record.clock_in_at).toISOString() : nowIso();
    const clockOutAt = record.clock_out_at && !Number.isNaN(new Date(record.clock_out_at).getTime()) ? new Date(record.clock_out_at).toISOString() : null;
    const date = clean(record.work_date) || clockInAt.slice(0,10);
    const project = clean(record.project_code) || 'UNMAPPED';
    return {
      id: clean(record.id) || uid(`IMPORT-${index+1}`),
      employee_id: clean(record.employee_id) || 'EMP-UNASSIGNED',
      employee_name: clean(record.employee_name) || clean(record.employee_id) || 'Imported employee',
      department: clean(record.department) || 'Unspecified',
      project_code: project,
      activity_description: clean(record.activity_description) || 'Imported work activity',
      work_date: date,
      clock_in_at: clockInAt,
      clock_out_at: clockOutAt,
      duration_hours: clockOutAt ? (Number(record.duration_hours) || durationHours(clockInAt,clockOutAt)) : 0,
      completion_percent: clamp(record.completion_percent,0,100),
      on_time: Boolean(record.on_time),
      delay_comments: clean(record.delay_comments),
      clock_in_location: clean(record.clock_in_location), clock_out_location: clean(record.clock_out_location),
      clock_in_lat: record.clock_in_lat==null?null:Number(record.clock_in_lat), clock_in_lng: record.clock_in_lng==null?null:Number(record.clock_in_lng),
      clock_out_lat: record.clock_out_lat==null?null:Number(record.clock_out_lat), clock_out_lng: record.clock_out_lng==null?null:Number(record.clock_out_lng),
      document_name: clean(record.document_name), document_type: clean(record.document_type), document_size: Number(record.document_size||0), document_data: clean(record.document_data),
      status: clockOutAt ? 'completed' : (record.status==='completed'?'completed':'active'), locked: Boolean(clockOutAt || record.locked),
      recovery_entry_id: clean(record.recovery_entry_id)||null,
      recovery_bridge_status: clean(record.recovery_bridge_status)||(clockOutAt?'eligible_for_draft':'pending_clock_out'),
      source: 'live_import', created_at: record.created_at || clockInAt, updated_at: record.updated_at || clockOutAt || nowIso()
    };
  }
  const date = clean(record.date) || new Date().toISOString().slice(0,10);
  const clockInAt = isoFromLegacy(date, record.clockIn, record.clockInTimestamp);
  const clockOutAt = record.locked || record.clockOutTimestamp || record.clockOut
    ? isoFromLegacy(date, record.clockOut, record.clockOutTimestamp)
    : null;
  const hours = clockOutAt ? durationHours(clockInAt, clockOutAt) || parseLegacyHours(record) : 0;
  const project = clean(record.project);
  const mapped = Boolean(project);
  return {
    id: clean(record.id) ? `LEGACY-${record.id}` : uid(`LEGACY-${index+1}`),
    employee_id: clean(record.employeeId) || 'EMP-UNASSIGNED',
    employee_name: clean(record.name) || engine.state.employees[0]?.name || 'Employee',
    department: clean(record.department) || 'Unspecified',
    project_code: project || 'UNMAPPED',
    activity_description: clean(record.activityDescription) || 'Imported legacy activity',
    work_date: date,
    clock_in_at: clockInAt,
    clock_out_at: clockOutAt,
    duration_hours: hours,
    completion_percent: clamp(record.completion,0,100),
    on_time: Boolean(record.onTime),
    delay_comments: clean(record.delaysChallenges),
    clock_in_location: clean(record.clockInLocation),
    clock_out_location: clean(record.clockOutLocation),
    clock_in_lat: null,
    clock_in_lng: null,
    clock_out_lat: null,
    clock_out_lng: null,
    document_name: clean(record.documentName || record.document?.name),
    document_type: clean(record.documentType || record.document?.type),
    document_size: Number(record.documentSize || record.document?.size || 0),
    document_data: clean(record.documentData || ''),
    status: clockOutAt ? 'completed' : 'active',
    locked: Boolean(clockOutAt),
    recovery_entry_id: null,
    recovery_bridge_status: mapped && clockOutAt ? 'eligible_for_draft' : (mapped ? 'pending_clock_out' : 'unmapped_project'),
    source: 'legacy_mts_import',
    created_at: clockInAt || nowIso(),
    updated_at: clockOutAt || nowIso()
  };
}

function dbSessionToApp(r) {
  return {
    id:r.id, employee_id:r.employee_id, employee_name:r.employee_name, department:r.department,
    project_code:r.project_code, activity_description:r.activity_description, work_date:r.work_date,
    clock_in_at:r.clock_in_at, clock_out_at:r.clock_out_at, duration_hours:Number(r.duration_hours||0),
    completion_percent:Number(r.completion_percent||0), on_time:Boolean(r.on_time), delay_comments:r.delay_comments||'',
    clock_in_location:r.clock_in_location||'', clock_out_location:r.clock_out_location||'',
    clock_in_lat:r.clock_in_lat==null?null:Number(r.clock_in_lat), clock_in_lng:r.clock_in_lng==null?null:Number(r.clock_in_lng),
    clock_out_lat:r.clock_out_lat==null?null:Number(r.clock_out_lat), clock_out_lng:r.clock_out_lng==null?null:Number(r.clock_out_lng),
    document_name:r.document_name||'', document_type:r.document_type||'', document_size:Number(r.document_size||0), document_data:r.document_data||'',
    status:r.status, locked:Boolean(r.locked), recovery_entry_id:r.recovery_entry_id||null,
    recovery_bridge_status:r.recovery_bridge_status||'not_bridged', source:r.source||'live', created_at:r.created_at, updated_at:r.updated_at
  };
}

export async function listMtsSessions({limit=1000,status,projectCode,employeeName,month,query}={}) {
  if (hasSupabaseConfig()) {
    let q = createServerSupabase().from('mts_work_sessions').select('*').order('clock_in_at',{ascending:false}).limit(Math.min(Number(limit)||1000,5000));
    if(status) q=q.eq('status',status);
    if(projectCode) q=q.eq('project_code',projectCode);
    if(month) q=q.gte('work_date',`${String(month).slice(0,7)}-01`).lt('work_date',new Date(Date.UTC(Number(String(month).slice(0,4)),Number(String(month).slice(5,7)),1)).toISOString().slice(0,10));
    const {data,error}=await q; if(error)throw error;
    let rows=(data||[]).map(dbSessionToApp);
    if(employeeName) rows=rows.filter(x=>x.employee_name.toLowerCase().includes(employeeName.toLowerCase()));
    if(query){const s=query.toLowerCase();rows=rows.filter(x=>[x.employee_name,x.department,x.project_code,x.activity_description,x.delay_comments,x.clock_in_location,x.clock_out_location].join(' ').toLowerCase().includes(s));}
    return rows;
  }
  let rows=(await readLocal()).sessions.slice().sort((a,b)=>String(b.clock_in_at).localeCompare(String(a.clock_in_at)));
  if(status)rows=rows.filter(x=>x.status===status);
  if(projectCode)rows=rows.filter(x=>x.project_code===projectCode);
  if(employeeName)rows=rows.filter(x=>clean(x.employee_name).toLowerCase().includes(employeeName.toLowerCase()));
  if(month)rows=rows.filter(x=>clean(x.work_date).startsWith(String(month).slice(0,7)));
  if(query){const s=query.toLowerCase();rows=rows.filter(x=>[x.employee_name,x.department,x.project_code,x.activity_description,x.delay_comments,x.clock_in_location,x.clock_out_location].join(' ').toLowerCase().includes(s));}
  return rows.slice(0,limit);
}

export async function getMtsSession(id) {
  if(hasSupabaseConfig()){
    const {data,error}=await createServerSupabase().from('mts_work_sessions').select('*').eq('id',String(id)).maybeSingle(); if(error)throw error; return data?dbSessionToApp(data):null;
  }
  return (await readLocal()).sessions.find(x=>String(x.id)===String(id))||null;
}

export async function searchMtsSessions(query,{limit=8}={}) {
  return listMtsSessions({query,limit});
}

export async function clockInMtsSession({employeeId='E001',employeeName,department,projectCode,activityDescription,clockInAt,location={},document={},sessionId=''}={}) {
  if(!clean(employeeId))throw new Error('Employee ID is required.');
  if(!clean(employeeName))throw new Error('Employee name is required.');
  if(!clean(projectCode))throw new Error('Project code is required.');
  if(!clean(activityDescription))throw new Error('Activity description is required.');
  const start=clockInAt && !Number.isNaN(new Date(clockInAt).getTime()) ? new Date(clockInAt).toISOString() : nowIso();
  await ensureLiveContextFromWorkSessions([{employee_id:clean(employeeId),employee_name:clean(employeeName),department:clean(department),project_code:clean(projectCode),work_date:start.slice(0,10),clock_in_at:start,status:'active'}]);
  const employee=engine.state.employees.find(e=>e.employeeId===clean(employeeId));
  const project=engine.state.projects.find(p=>p.code===clean(projectCode));
  const active=(await listMtsSessions({limit:5000})).find(x=>['active','rework_required'].includes(x.status)&&x.employee_id===employee.employeeId);
  if(active)throw new Error(`${employee.name} already has an active work session (${active.id}). Clock it out first.`);
  const row={
    id:uid('MTS'), employee_id:employee.employeeId, employee_name:clean(employeeName)||employee.name,
    department:clean(department)||'Unspecified', project_code:project.code, activity_description:clean(activityDescription),
    work_date:start.slice(0,10), clock_in_at:start, clock_out_at:null, duration_hours:0,
    completion_percent:0, on_time:false, delay_comments:'',
    clock_in_location:clean(location.label), clock_out_location:'',
    clock_in_lat:location.lat==null?null:Number(location.lat), clock_in_lng:location.lng==null?null:Number(location.lng), clock_out_lat:null, clock_out_lng:null,
    document_name:clean(document.name), document_type:clean(document.type), document_size:Number(document.size||0), document_data:clean(document.data),
    status:'active', locked:false, recovery_entry_id:null, recovery_bridge_status:'pending_clock_out', source:'live', created_at:nowIso(), updated_at:nowIso()
  };
  if(hasSupabaseConfig()){
    const db=createServerSupabase(); const {data,error}=await db.from('mts_work_sessions').insert(row).select('*').single(); if(error)throw error;
    await logAction({sessionId,actionName:'mts_clock_in',inputData:{employeeId:row.employee_id,projectCode:row.project_code,activityDescription:row.activity_description},resultData:{id:row.id},status:'completed'});
    const saved=dbSessionToApp(data); await ensureLiveContextFromWorkSessions(await listMtsSessions({month:row.work_date.slice(0,7),limit:5000}));
    return saved;
  }
  const store=await readLocal(); store.sessions.push(row); await writeLocal(store);
  await logAction({sessionId,actionName:'mts_clock_in',inputData:{employeeId:row.employee_id,projectCode:row.project_code,activityDescription:row.activity_description},resultData:{id:row.id},status:'completed'});
  await ensureLiveContextFromWorkSessions(await listMtsSessions({month:row.work_date.slice(0,7),limit:5000}));
  return row;
}

export async function clockOutMtsSession({id,clockOutAt,location={},completionPercent=100,onTime=true,delayComments='',sessionId=''}={}) {
  let row=await getMtsSession(id); if(!row)throw new Error('Work session not found.');
  if(row.status==='completed')return row;
  const out=clockOutAt && !Number.isNaN(new Date(clockOutAt).getTime()) ? new Date(clockOutAt).toISOString() : nowIso();
  const rework=row.status==='rework_required';
  const incremental=durationHours(rework?(row.updated_at||row.clock_out_at||row.clock_in_at):row.clock_in_at,out);
  const hours=rework?Number(row.duration_hours||0)+incremental:incremental;
  if((rework&&incremental<=0)||(!rework&&hours<=0))throw new Error('Clock-out time must be after the active work period began.');
  row={...row,clock_out_at:out,duration_hours:hours,completion_percent:clamp(completionPercent,0,100),on_time:Boolean(onTime),delay_comments:clean(delayComments),clock_out_location:clean(location.label),clock_out_lat:location.lat==null?null:Number(location.lat),clock_out_lng:location.lng==null?null:Number(location.lng),status:'completed',locked:true,updated_at:nowIso()};

  let bridgeStatus='draft_created', recoveryEntryId=row.recovery_entry_id;
  try{
    if(!recoveryEntryId){
      const draft=await addDraftTimeEntry({date:row.work_date,projectCode:row.project_code,hours:row.duration_hours,activity:row.activity_description,employeeId:row.employee_id,sessionId});
      recoveryEntryId=draft.entryId;
    }
  }catch(error){bridgeStatus=`bridge_review: ${error.message}`;}
  row.recovery_entry_id=recoveryEntryId||null; row.recovery_bridge_status=bridgeStatus;

  if(hasSupabaseConfig()){
    const db=createServerSupabase();
    const {data,error}=await db.from('mts_work_sessions').update({clock_out_at:row.clock_out_at,duration_hours:row.duration_hours,completion_percent:row.completion_percent,on_time:row.on_time,delay_comments:row.delay_comments,clock_out_location:row.clock_out_location,clock_out_lat:row.clock_out_lat,clock_out_lng:row.clock_out_lng,status:row.status,locked:row.locked,recovery_entry_id:row.recovery_entry_id,recovery_bridge_status:row.recovery_bridge_status,updated_at:row.updated_at}).eq('id',row.id).select('*').single(); if(error)throw error;
    await logAction({sessionId,actionName:'mts_clock_out',inputData:{id:row.id,completionPercent:row.completion_percent,onTime:row.on_time},resultData:{duration_hours:row.duration_hours,recovery_entry_id:row.recovery_entry_id,recovery_bridge_status:row.recovery_bridge_status},status:'completed'});
    const saved=dbSessionToApp(data); await ensureLiveContextFromWorkSessions(await listMtsSessions({month:row.work_date.slice(0,7),limit:5000}));
    return saved;
  }
  const store=await readLocal(); const idx=store.sessions.findIndex(x=>String(x.id)===String(row.id)); if(idx<0)throw new Error('Work session not found.'); store.sessions[idx]=row; await writeLocal(store);
  await logAction({sessionId,actionName:'mts_clock_out',inputData:{id:row.id,completionPercent:row.completion_percent,onTime:row.on_time},resultData:{duration_hours:row.duration_hours,recovery_entry_id:row.recovery_entry_id,recovery_bridge_status:row.recovery_bridge_status},status:'completed'});
  await ensureLiveContextFromWorkSessions(await listMtsSessions({month:row.work_date.slice(0,7),limit:5000}));
  return row;
}


export async function markMtsSessionDocumentRework(id,{reason='',sessionId=''}={}) {
  let row=await getMtsSession(id);if(!row)return null;
  const stamped=nowIso(),comment=[clean(row.delay_comments),`Document rework required${clean(reason)?`: ${clean(reason)}`:''}`].filter(Boolean).join(' · ');
  row={...row,status:'rework_required',locked:false,completion_percent:Math.min(Number(row.completion_percent||0),90),recovery_bridge_status:'document_rework_required',delay_comments:comment,updated_at:stamped};
  if(hasSupabaseConfig()){
    const db=createServerSupabase();const {data,error}=await db.from('mts_work_sessions').update({status:row.status,locked:row.locked,completion_percent:row.completion_percent,recovery_bridge_status:row.recovery_bridge_status,delay_comments:row.delay_comments,updated_at:row.updated_at}).eq('id',row.id).select('*').single();if(error)throw error;
    await logAction({sessionId,actionName:'mts_document_rework',inputData:{id:row.id},resultData:{status:row.status},status:'completed'});return dbSessionToApp(data);
  }
  const store=await readLocal(),idx=store.sessions.findIndex(x=>String(x.id)===String(row.id));if(idx<0)return null;store.sessions[idx]=row;await writeLocal(store);
  await logAction({sessionId,actionName:'mts_document_rework',inputData:{id:row.id},resultData:{status:row.status},status:'completed'});return row;
}

export async function importLegacyMtsRecords(records,{sessionId='',bridgeCompleted=false}={}) {
  if(!Array.isArray(records))throw new Error('Legacy import must be an array of records.');
  const normalized=records.map((r,i)=>normalizeLegacyMtsRecord(r,i));
  const output=[];
  for(const row0 of normalized){
    let row=row0;
    if(hasSupabaseConfig()){
      const db=createServerSupabase(); const {data,error}=await db.from('mts_work_sessions').upsert(row,{onConflict:'id'}).select('*').single(); if(error)throw error; row=dbSessionToApp(data);
    }else{
      const store=await readLocal(); const idx=store.sessions.findIndex(x=>x.id===row.id); if(idx>=0)store.sessions[idx]=row; else store.sessions.push(row); await writeLocal(store);
    }
    await ensureLiveContextFromWorkSessions([row]);
    if(bridgeCompleted && row.status==='completed' && engine.state.projects.some(p=>p.code===row.project_code) && row.duration_hours>0 && row.duration_hours<=24 && !row.recovery_entry_id){
      try{
        const draft=await addDraftTimeEntry({date:row.work_date,projectCode:row.project_code,hours:row.duration_hours,activity:row.activity_description,employeeId:row.employee_id,sessionId});
        row.recovery_entry_id=draft.entryId; row.recovery_bridge_status='draft_created';
        if(hasSupabaseConfig()) await createServerSupabase().from('mts_work_sessions').update({recovery_entry_id:row.recovery_entry_id,recovery_bridge_status:row.recovery_bridge_status}).eq('id',row.id);
        else {const store=await readLocal(); const idx=store.sessions.findIndex(x=>x.id===row.id); store.sessions[idx]=row; await writeLocal(store);}
      }catch(error){row.recovery_bridge_status=`bridge_review: ${error.message}`;}
    }
    output.push(row);
  }
  const touchedMonths=[...new Set(output.map(row=>clean(row.work_date).slice(0,7)).filter(Boolean))];
  for (const month of touchedMonths) await ensureLiveContextFromWorkSessions(await listMtsSessions({month,limit:5000}));
  await logAction({sessionId,actionName:'mts_import_legacy',inputData:{count:records.length,bridgeCompleted},resultData:{imported:output.length},status:'completed'});
  return output;
}

export function computeMtsAnalytics(sessions,{month}={}) {
  const completed=(sessions||[]).filter(x=>x.status==='completed' && Number(x.duration_hours)>0);
  const filtered=month?completed.filter(x=>clean(x.work_date).startsWith(String(month).slice(0,7))):completed;
  const sum=(arr,fn)=>arr.reduce((a,x)=>a+Number(fn(x)||0),0);
  const perf=(key)=>{
    const groups={};
    for(const s of filtered){const name=clean(s[key])||'Unspecified';groups[name]??={totalHours:0,totalCompletion:0,entries:0};groups[name].totalHours+=Number(s.duration_hours||0);groups[name].totalCompletion+=Number(s.completion_percent||0);groups[name].entries++;}
    const maxHours=Math.max(0,...Object.values(groups).map(x=>x.totalHours));
    return Object.entries(groups).map(([name,d])=>({name,totalHours:d.totalHours,averageCompletion:d.entries?d.totalCompletion/d.entries:0,entries:d.entries,weightedScore:(d.entries?d.totalCompletion/d.entries:0)*0.7+(maxHours?d.totalHours/maxHours*100:0)*0.3})).sort((a,b)=>b.weightedScore-a.weightedScore);
  };
  const employeePerformance=perf('employee_name'); const departmentPerformance=perf('department'); const projectPerformance=perf('project_code');
  const daily={};
  for(const s of filtered){const d=s.work_date;daily[d]??={date:d,earliest:null,latest:null,totalHours:0};daily[d].totalHours+=Number(s.duration_hours||0);if(!daily[d].earliest||new Date(s.clock_in_at)<new Date(daily[d].earliest.clock_in_at))daily[d].earliest=s;if(!daily[d].latest||new Date(s.clock_out_at)>new Date(daily[d].latest.clock_out_at))daily[d].latest=s;}
  const perEmployeeDay={};
  for(const s of filtered){const k=`${s.work_date}__${s.employee_name}`;perEmployeeDay[k]=(perEmployeeDay[k]||0)+Number(s.duration_hours||0);}
  const overtime=Object.entries(perEmployeeDay).filter(([,h])=>h>8).map(([k,h])=>{const [date,employee_name]=k.split('__');return {date,employee_name,hours:h};}).sort((a,b)=>b.hours-a.hours);
  const jobs={};
  for(const s of filtered){jobs[s.project_code]??={project_code:s.project_code,completed:0,total:0,totalHours:0};jobs[s.project_code].total++;jobs[s.project_code].totalHours+=Number(s.duration_hours||0);if(Number(s.completion_percent)===100)jobs[s.project_code].completed++;}
  const byMonth={};
  for(const s of completed){const m=clean(s.work_date).slice(0,7);byMonth[m]=(byMonth[m]||0)+Number(s.duration_hours||0);}
  return {
    period:month||'all', total_sessions:(sessions||[]).length, active_sessions:(sessions||[]).filter(x=>['active','rework_required'].includes(x.status)).length,
    completed_sessions:filtered.length,total_hours:sum(filtered,x=>x.duration_hours),average_completion:filtered.length?sum(filtered,x=>x.completion_percent)/filtered.length:0,
    recovery_drafts:filtered.filter(x=>x.recovery_entry_id).length,unbridged:filtered.filter(x=>!x.recovery_entry_id).length,
    top_workers:employeePerformance.slice(0,3),employee_performance:employeePerformance,department_performance:departmentPerformance,project_performance:projectPerformance,
    daily_analytics:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date)),employee_of_month:employeePerformance[0]||null,
    jobs_analytics:Object.values(jobs).sort((a,b)=>b.totalHours-a.totalHours),overtime,
    hours_by_project:projectPerformance.map(x=>({project_code:x.name,hours:x.totalHours,average_completion:x.averageCompletion})),
    hours_by_month:Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([month,hours])=>({month,hours}))
  };
}

export async function getMtsOverview({month}={}) {
  const sessions=await listMtsSessions({limit:5000}); return computeMtsAnalytics(sessions,{month});
}

export async function createMtsMessage({recipient,sender='Recovery Passport System',content,sessionId=''}={}) {
  if(!clean(recipient)||!clean(content))throw new Error('Recipient and message content are required.');
  const row={id:uid('MSG'),recipient:clean(recipient),sender:clean(sender)||'Recovery Passport System',content:clean(content),read:false,created_at:nowIso()};
  if(hasSupabaseConfig()){
    const {data,error}=await createServerSupabase().from('mts_messages').insert(row).select('*').single(); if(error)throw error; await logAction({sessionId,actionName:'mts_send_internal_message',inputData:{recipient:row.recipient},resultData:{id:row.id},status:'completed'}); return data;
  }
  const store=await readLocal(); store.messages.unshift(row); await writeLocal(store); await logAction({sessionId,actionName:'mts_send_internal_message',inputData:{recipient:row.recipient},resultData:{id:row.id},status:'completed'}); return row;
}

export async function listMtsMessages({limit=100,recipient}={}) {
  if(hasSupabaseConfig()){
    let q=createServerSupabase().from('mts_messages').select('*').order('created_at',{ascending:false}).limit(Math.min(limit,1000));if(recipient)q=q.eq('recipient',recipient);const {data,error}=await q;if(error)throw error;return data||[];
  }
  let rows=(await readLocal()).messages.slice();if(recipient)rows=rows.filter(x=>x.recipient===recipient);return rows.slice(0,limit);
}


export async function markMtsMessageRead(id,{reader=''}={}) {
  if(!clean(id))throw new Error('Message ID is required.');
  if(hasSupabaseConfig()){
    const db=createServerSupabase();const {data,error}=await db.from('mts_messages').update({read:true}).eq('id',id).select('*').single();if(error)throw error;return data;
  }
  const store=await readLocal();const row=store.messages.find(x=>String(x.id)===String(id));if(!row)throw new Error('Message not found.');row.read=true;row.read_at=nowIso();row.read_by=clean(reader);await writeLocal(store);return row;
}

export async function getUnifiedEvidenceTrace({mtsSessionId}={}) {
  const session=await getMtsSession(mtsSessionId); if(!session)return null;
  const recoveryEntry=session.recovery_entry_id ? engine.analyzedTimeEntries().find(x=>x.entryId===session.recovery_entry_id)||null : null;
  const monthly=recoveryEntry ? engine.monthlyEngine().find(x=>x.month===recoveryEntry.month)||null : null;
  const passport=recoveryEntry && recoveryEntry.projectCode ? engine.recoveryPassport(recoveryEntry.month,recoveryEntry.projectCode) : null;
  return {mts_session:session,recovery_time_entry:recoveryEntry,monthly_engine:monthly,recovery_passport:passport,trace:['MTS work session','Draft/approved time entry','Daily & eligibility checks','Monthly engine','Recovery Passport']};
}
