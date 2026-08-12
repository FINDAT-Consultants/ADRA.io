import { engine } from './engine-runtime.js';
import { scheduleIntelligenceRefresh, predictProjectCoding, getIntelligenceStatus } from './intelligence-engine.js';
import { writeAppState } from './supabase-state.js';
const clean = v => String(v ?? '').trim();
const companyOf=input=>clean(input?.companyId||input?.company_id)||'COMPANY-DEFAULT';
const tagCompany=(row,input)=>{if(row)row.companyId=companyOf(input);return row;};
const monthKey = v => globalThis.ADRAEngine.monthKey(v);
const empty = () => ({employees:[],projects:[],payroll:[],calendar:[],timeEntries:[],sources:[],sourceChecks:[],vacancies:[],candidates:[],onboarding:[]});

export async function persistLiveState() {
  const snapshot = empty();
  for (const key of Object.keys(snapshot)) snapshot[key] = JSON.parse(JSON.stringify(engine.state[key] || []));
  await writeAppState('live-system-data', snapshot);
  scheduleIntelligenceRefresh({reason:'live-operational-data-updated'});
  return snapshot;
}

export function getLiveState() {
  const out=empty();
  for (const key of Object.keys(out)) out[key]=JSON.parse(JSON.stringify(engine.state[key]||[]));
  return out;
}

export async function upsertLiveEmployee(input={}) {
  const row=engine.upsertEmployee({
    employeeId:clean(input.employeeId||input.employee_id), name:clean(input.name||input.employee_name),
    position:input.position === undefined ? undefined : clean(input.position), supervisor:input.supervisor === undefined ? undefined : clean(input.supervisor),
    department:input.department === undefined ? undefined : clean(input.department), team:input.team === undefined ? undefined : clean(input.team),
    email:input.email === undefined ? undefined : clean(input.email), phone:input.phone === undefined ? undefined : clean(input.phone), skype:input.skype === undefined ? undefined : clean(input.skype),
    profilePhoto:(input.profilePhoto ?? input.profile_photo) === undefined ? undefined : clean(input.profilePhoto ?? input.profile_photo),
    teamLead:input.teamLead ?? input.team_lead, hoursPerDay:Number(input.hoursPerDay??input.hours_per_day??8),
    employmentType:input.employmentType===undefined&&input.employment_type===undefined?undefined:clean(input.employmentType??input.employment_type),
    employmentStatus:input.employmentStatus===undefined&&input.employment_status===undefined?undefined:clean(input.employmentStatus??input.employment_status),
    location:input.location===undefined?undefined:clean(input.location),
    startDate:input.startDate||input.start_date||undefined, endDate:input.endDate||input.end_date||undefined, active:input.active||'Yes'
  });
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function upsertLiveProject(input={}) {
  const row=engine.upsertProject({
    code:clean(input.code||input.project_code), name:clean(input.name||input.project_name||input.code||input.project_code), donor:clean(input.donor),
    startDate:input.startDate||input.start_date||null, endDate:input.endDate||input.end_date||null, status:input.status||'Active',
    adminAllowed:input.adminAllowed||input.admin_allowed||'No', personnelBudget:Number(input.personnelBudget??input.personnel_budget??0),
    eligibleEmployeeId:clean(input.eligibleEmployeeId||input.eligible_employee_id)
  });
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function upsertLivePayroll(input={}) {
  const row=engine.upsertPayroll({
    month:input.month, employeeId:clean(input.employeeId||input.employee_id), basicSalary:Number(input.basicSalary??input.basic_salary??0),
    benefits:Number(input.benefits||0), statutoryCost:Number(input.statutoryCost??input.statutory_cost??0), exclusions:Number(input.exclusions||0),
    source:clean(input.source)||'User input', configurationStatus:input.configurationStatus||input.configuration_status||'COMPLETE', notes:clean(input.notes)
  });
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function upsertLiveCalendar(input={}) {
  const row=engine.upsertCalendar({date:input.date,dayType:input.dayType||input.day_type||'Working Day',standardHours:Number(input.standardHours??input.standard_hours??0),holidaySource:clean(input.holidaySource||input.holiday_source)});
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function addLiveTimeEntry(input={}) {
  const projectCode=clean(input.projectCode||input.project_code),activity=clean(input.activity||input.activity_description);
  let aiSuggested=clean(input.aiSuggestedProject||input.ai_suggested_project),aiConfidence=input.aiConfidence??input.ai_confidence,decision=input.employeeDecision||input.employee_decision;
  if(!aiSuggested){
    const status=getIntelligenceStatus(),prediction=predictProjectCoding(activity,{limit:1})[0];
    const liveReady=['EARLY_LIVE','LIVE_LEARNING','LIVE_MATURE'].includes(status.quality);
    aiSuggested=liveReady&&prediction?.confidence>=0.55?prediction.label:projectCode;
    aiConfidence=prediction?.confidence??0;
    decision=aiSuggested===projectCode?'Accepted':'Review';
  }
  const result=engine.addTimeEntry({
    entryId:clean(input.entryId||input.entry_id)||undefined, date:input.date, projectCode,
    hours:Number(input.hours||0), activity, employeeId:clean(input.employeeId||input.employee_id),
    status:input.status||'Draft', aiSuggestedProject:aiSuggested||projectCode,
    aiConfidence:Number(aiConfidence??0), employeeDecision:decision||'Accepted'
  });
  tagCompany(result,input); await persistLiveState(); return result;
}


export async function upsertLiveVacancy(input={}) {
  const row=engine.upsertVacancy({id:clean(input.id||input.vacancy_id)||undefined,title:clean(input.title||input.job_title),department:clean(input.department),location:clean(input.location),employmentType:clean(input.employmentType||input.employment_type)||'Full Time',status:clean(input.status)||'Open',openDate:input.openDate||input.open_date||undefined,closeDate:input.closeDate||input.close_date||undefined});
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function upsertLiveCandidate(input={}) {
  const row=engine.upsertCandidate({id:clean(input.id||input.candidate_id)||undefined,name:clean(input.name||input.candidate_name),email:clean(input.email),phone:clean(input.phone),vacancyId:clean(input.vacancyId||input.vacancy_id),jobTitle:clean(input.jobTitle||input.job_title),department:clean(input.department),location:clean(input.location),employmentType:clean(input.employmentType||input.employment_type)||'Full Time',stage:clean(input.stage)||'Applied',status:clean(input.status)||'Active',profilePhoto:clean(input.profilePhoto||input.profile_photo),appliedDate:input.appliedDate||input.applied_date||undefined,notes:clean(input.notes)});
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function upsertLiveOnboarding(input={}) {
  const row=engine.upsertOnboarding({id:clean(input.id||input.onboarding_id)||undefined,candidateId:clean(input.candidateId||input.candidate_id),employeeId:clean(input.employeeId||input.employee_id),name:clean(input.name||input.employee_name),jobTitle:clean(input.jobTitle||input.job_title),department:clean(input.department),location:clean(input.location),employmentType:clean(input.employmentType||input.employment_type)||'Full Time',hireDate:input.hireDate||input.hire_date||undefined,profilePhoto:clean(input.profilePhoto||input.profile_photo),step:Number(input.step||1),status:clean(input.status)||'In Progress',checklist:input.checklist||{}});
  if(String(row.status).toLowerCase()==='complete' && row.employeeId){
    if(row.candidateId){const c=engine.state.candidates.find(x=>x.id===row.candidateId);if(c)engine.upsertCandidate({...c,status:'Hired',stage:'Offer Accepted'});}
    const employee=engine.upsertEmployee({employeeId:row.employeeId,name:row.name,position:row.jobTitle,department:row.department,location:row.location,employmentType:row.employmentType,employmentStatus:'Active',profilePhoto:row.profilePhoto,startDate:row.hireDate,active:'Yes',hoursPerDay:8});employee.companyId=companyOf(input);
  }
  tagCompany(row,input); await persistLiveState(); return row;
}

export async function assignLiveContextCompany({employeeId='',projectCode='',date='',companyId='COMPANY-DEFAULT'}={}){
  const company=clean(companyId)||'COMPANY-DEFAULT',employee=clean(employeeId),project=clean(projectCode),day=clean(date).slice(0,10),month=day?monthKey(day):'';
  for(const row of engine.state.employees)if(employee&&row.employeeId===employee)row.companyId=company;
  for(const row of engine.state.projects)if(project&&row.code===project)row.companyId=company;
  for(const row of engine.state.payroll)if(employee&&row.employeeId===employee&&(!month||row.month===month))row.companyId=company;
  for(const row of engine.state.calendar)if(day&&row.date===day)row.companyId=company;
  for(const row of engine.state.timeEntries)if(employee&&row.employeeId===employee&&(!project||row.projectCode===project)&&(!day||row.date===day))row.companyId=company;
  await persistLiveState();return getLiveState();
}

export async function ensureLiveContextFromWorkSessions(sessions=[]) {
  const touchedMonths=new Set();
  for (const s of sessions) {
    const employeeId=clean(s.employee_id)||'EMP-UNASSIGNED';
    let employee=engine.state.employees.find(e=>e.employeeId===employeeId);
    if (!employee) employee=engine.upsertEmployee({employeeId,name:clean(s.employee_name)||employeeId,position:clean(s.department),department:clean(s.department),hoursPerDay:8,active:'Yes'});
    else { if (clean(s.employee_name) && !employee.name) employee.name=clean(s.employee_name); if (clean(s.department) && !employee.department) employee.department=clean(s.department); }

    const code=clean(s.project_code)||'UNMAPPED';
    let project=engine.state.projects.find(p=>p.code===code);
    if (!project) project=engine.upsertProject({code,name:code,status:'Active',personnelBudget:0,eligibleEmployeeId:employeeId});
    else {
      const ids=String(project.eligibleEmployeeId||'').split(',').map(x=>x.trim()).filter(Boolean);
      if (!ids.includes(employeeId)) project.eligibleEmployeeId=[...ids,employeeId].join(', ');
    }

    const date=clean(s.work_date)||clean(s.clock_in_at).slice(0,10);
    if (date) {
      const existing=engine.state.calendar.find(c=>c.date===date);
      if (!existing) engine.upsertCalendar({date,dayType:'Working Day',standardHours:Number(employee.hoursPerDay||8),holidaySource:'Auto-created from Work Activity Hub'});
      const month=monthKey(date);
      const payrollKey=`${month}__${employeeId}`;
      if (!engine.state.payroll.some(p=>`${p.month}__${p.employeeId}`===payrollKey)) {
        engine.upsertPayroll({month,employeeId,basicSalary:0,benefits:0,statutoryCost:0,exclusions:0,source:'Awaiting payroll input — created by Work Activity Hub',configurationStatus:'REVIEW',notes:'Live payroll placeholder only. Monetary amounts must be entered or imported from an authorized payroll source.'});
      }
      touchedMonths.add(month);
    }
  }
  for (const month of touchedMonths) {
    const hours=sessions.filter(s=>monthKey(s.work_date||s.clock_in_at)===month && s.status==='completed').reduce((a,s)=>a+Number(s.duration_hours||0),0);
    engine.upsertSourceCheck({month,check:'Work Activity Hub completed hours',sourceTarget:hours,severity:'Critical',whereToFix:'Work Activity Hub / Recovery Time Entry'});
  }
  await persistLiveState();
  return getLiveState();
}
