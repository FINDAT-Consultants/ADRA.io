import { engine } from './engine-runtime.js';
import { createServerSupabase } from './supabase.js';
import { logAction } from './record-store.js';
import { addLiveTimeEntry } from './live-data-store.js';
import { predictProjectCoding, getIntelligenceStatus } from './intelligence-engine.js';

export async function initializeRuntimeEntries(){
  return { loaded:engine.state.timeEntries.length, source:'live-system-data' };
}

export async function addDraftTimeEntry({date,projectCode,hours,activity,employeeId='',sessionId='',status='Draft'}){
  const project=engine.state.projects.find(p=>p.code===projectCode);
  const employee=engine.state.employees.find(e=>e.employeeId===employeeId) || engine.state.employees[0];
  if(!project)throw new Error('Unknown project code.');
  if(!employee)throw new Error('Unknown employee.');
  const ml=predictProjectCoding(activity,{limit:1})[0],mlReady=['EARLY_LIVE','LIVE_LEARNING','LIVE_MATURE'].includes(getIntelligenceStatus().quality),suggested=mlReady&&ml?.confidence>=0.55?ml.label:projectCode;
  const input={date,projectCode,hours:Number(hours),activity,employeeId:employee.employeeId,status,aiSuggestedProject:suggested,aiConfidence:Number(ml?.confidence||0),employeeDecision:suggested===projectCode?'Accepted':'Review'};
  if(!(input.hours>0&&input.hours<=24))throw new Error('Hours must be between 0 and 24.');
  if(!String(activity||'').trim())throw new Error('Activity is required.');
  input.entryId=`LIVE-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

  const month=String(date).slice(0,7)+'-01';
  const db=createServerSupabase();
  const {error}=await db.from('workbook_time_entries').insert({entry_id:input.entryId,work_date:date,month,employee_id:employee.employeeId,employee_name:employee.name,project_code:project.code,activity_evidence:String(activity).trim(),hours:input.hours,time_type:project.code==='ADMIN - Overhead'?'Administration':'Direct project',status:input.status,ai_suggested_project:input.aiSuggestedProject,ai_confidence:input.aiConfidence,employee_decision:input.employeeDecision});
  if(error)throw error;
  const result=await addLiveTimeEntry(input);
  await logAction({sessionId,actionName:'add_draft_time_entry',inputData:input,resultData:result,status:'completed'});
  return result;
}
