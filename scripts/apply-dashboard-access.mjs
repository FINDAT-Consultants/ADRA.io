import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const targets = [];
const rootApp = resolve(root, 'app.js');
if (existsSync(rootApp)) targets.push(rootApp);
if (existsSync(publicDir)) {
  for (const name of readdirSync(publicDir)) {
    if (/^app(?:\.|-).*\.js$/iu.test(name)) targets.push(join(publicDir, name));
  }
}
if (!targets.length) throw new Error('No Assurance Regent application runtime was found for the dashboard RBAC patch.');

const marker = 'v6.3.26 — role-scoped dashboard analytics';
const helper = `
  /* ${marker}. */
  function dashboardAnalyticsVisibility(el,visible){
    if(!el)return;
    el.hidden=!visible;
    el.setAttribute('aria-hidden',visible?'false':'true');
    if(visible)el.style.removeProperty('display');else el.style.setProperty('display','none','important');
  }
  function applyDashboardAnalyticsAccess(monthRows=[],analytics=null,dashboard=null){
    const user=controlUser()||{},authority=functionalAuthority(effectiveUserOrg(user)),a=analytics||mtsAnalytics(monthRows||[]);
    const policy={
      DEVELOPER:{summary:'org',people:true,salary:true,leave:true,recovery:true},
      CEO:{summary:'org',people:true,salary:true,leave:true,recovery:true},
      ADMINISTRATOR:{summary:'org',people:true,salary:true,leave:true,recovery:true},
      HR_MANAGER:{summary:'hr',people:true,salary:false,leave:true,recovery:false},
      FINANCE_MANAGER:{summary:'none',people:false,salary:true,leave:false,recovery:true},
      PROGRAMS_MANAGER:{summary:'team',people:true,salary:false,leave:true,recovery:false},
      PROJECT_MANAGER:{summary:'team',people:true,salary:false,leave:true,recovery:false},
      HEAD_OF_DEPARTMENT:{summary:'team',people:true,salary:false,leave:true,recovery:false},
      SUPERVISOR:{summary:'team',people:true,salary:false,leave:true,recovery:false},
      AUDITOR:{summary:'none',people:false,salary:false,leave:false,recovery:true},
      EMPLOYEE:{summary:'self',people:true,salary:false,leave:true,recovery:false}
    };
    const p=policy[authority]||policy.EMPLOYEE,view=$('view-dashboard');if(!view)return;
    const summary=view.querySelector('.people-summary-card'),salary=view.querySelector('.people-salary-card'),top=view.querySelector('.people-dashboard-top');
    dashboardAnalyticsVisibility(summary,p.summary!=='none');dashboardAnalyticsVisibility(salary,p.salary);dashboardAnalyticsVisibility(top,p.summary!=='none'||p.salary);
    if(top)top.style.gridTemplateColumns=(p.summary!=='none'&&p.salary)?'':'1fr';
    const peopleGrid=view.querySelector('.people-activity-grid'),peopleHeading=peopleGrid?.previousElementSibling;
    dashboardAnalyticsVisibility(peopleGrid,p.people);dashboardAnalyticsVisibility(peopleHeading,p.people);
    const leavePanel=view.querySelector('.leave-dashboard-panel'),leaveHeading=leavePanel?.previousElementSibling;
    dashboardAnalyticsVisibility(leavePanel,p.leave);dashboardAnalyticsVisibility(leaveHeading,p.leave);
    const recoveryHeading=view.querySelector('.analytics-heading'),risk=$('recoveryRiskDashboard'),cost=$('costChart')?.closest('.chart-panel'),hours=$('hoursChart')?.closest('.chart-panel'),readiness=$('readinessChart')?.closest('.chart-panel'),project=$('projectChart')?.closest('.chart-panel'),monthly=$('dashboardBody')?.closest('section.panel');
    dashboardAnalyticsVisibility(recoveryHeading,p.recovery);dashboardAnalyticsVisibility(risk,p.recovery&&canUseRecoveryAssurance());dashboardAnalyticsVisibility(cost,p.recovery);dashboardAnalyticsVisibility(hours,p.recovery);dashboardAnalyticsVisibility(readiness,p.recovery);dashboardAnalyticsVisibility(project,p.recovery);dashboardAnalyticsVisibility(monthly,p.recovery);
    const primary=summary?.querySelector('.people-summary-primary'),label=primary?.querySelector('small'),value=$('dashEmployeeCount'),note=primary?.querySelector('span'),kpis=$('dashboardKpis');
    if(p.summary==='self'){
      if(label)label.textContent='My recorded hours';if(value)value.textContent=num(a.total_hours||0,2);if(note)note.textContent='Your activity in the selected reporting month';
      if(kpis)kpis.innerHTML=[['Active sessions',a.active_sessions,'Your live work'],['Completed work',a.completed_sessions,'Your clocked-out sessions'],['Recovery drafts',a.recovery_drafts,'Your linked recovery evidence']].map(x=>\`<article class="people-summary-metric"><small>\${x[0]}</small><b>\${x[1]}</b><span>\${x[2]}</span></article>\`).join('');
    }else if(p.summary==='team'){
      const team=managedEmployeesForUser(user);if(label)label.textContent='Team members';if(value)value.textContent=team.length;if(note)note.textContent='People within your permitted management scope';
      if(kpis)kpis.innerHTML=[['Active work',a.active_sessions,'Team sessions in progress'],['Completed work',a.completed_sessions,'Team sessions this month'],['Recorded hours',num(a.total_hours||0,2),'Team hours in scope']].map(x=>\`<article class="people-summary-metric"><small>\${x[0]}</small><b>\${x[1]}</b><span>\${x[2]}</span></article>\`).join('');
    }else if(p.summary==='hr'){
      const employees=(engine.state.employees||[]).filter(e=>String(e.active||'Yes').toLowerCase()!=='no');if(label)label.textContent='Total Employees';if(value)value.textContent=employees.length;if(note)note.textContent='Live company workforce in HR scope';
      const pending=(state.leaveRequests||[]).filter(x=>String(x.status||'').toUpperCase()==='PENDING').length;
      if(kpis)kpis.innerHTML=[['Active work',a.active_sessions,'Live workforce activity'],['Completed work',a.completed_sessions,'Completed sessions this month'],['Pending leave',pending,'Awaiting HR decision']].map(x=>\`<article class="people-summary-metric"><small>\${x[0]}</small><b>\${x[1]}</b><span>\${x[2]}</span></article>\`).join('');
    }else if(p.summary==='org'){
      if(label)label.textContent='Total Employees';if(value)value.textContent=(engine.state.employees||[]).filter(e=>String(e.active||'Yes').toLowerCase()!=='no').length;if(note)note.textContent='Live company directory';
    }
    if($('pageSubtitle')&&state.view==='dashboard')$('pageSubtitle').textContent=authority==='EMPLOYEE'?'Your work, time, leave and calendar analytics for the selected reporting period.':authority==='HR_MANAGER'?'Workforce, activity, leave and people analytics within HR authority.':authority==='FINANCE_MANAGER'?'Financial, payroll-distribution and recovery analytics within Finance authority.':authority==='AUDITOR'?'Recovery, assurance and audit-relevant analytics within your authority.':(['PROGRAMS_MANAGER','PROJECT_MANAGER','HEAD_OF_DEPARTMENT','SUPERVISOR'].includes(authority)?'Team activity, leave and operational analytics within your management scope.':'Recovery status, cost composition, capacity and readiness across the reporting period.');
  }
`;

let changed = 0;
for (const file of targets) {
  let source = readFileSync(file, 'utf8');
  const original = source;

  if (!source.includes(marker)) {
    const anchor = '  async function renderDashboard(){';
    if (!source.includes(anchor)) throw new Error(`Dashboard renderer insertion point was not found in ${basename(file)}.`);
    source = source.replace(anchor, `${helper}\n${anchor}`);
  }

  if (!source.includes('v6.3.26 — dashboard leave analytics are scoped')) {
    const old = "    const req=state.leaveRequests||[],sts=state.workStatuses||[],today=";
    const next = "    /* v6.3.26 — dashboard leave analytics are scoped to functional authority. */\n    const dashAuthority=functionalAuthority(effectiveUserOrg(controlUser()||{})),dashLeaveBroad=['DEVELOPER','CEO','ADMINISTRATOR','HR_MANAGER'].includes(dashAuthority),dashIds=managedEmployeeIdSet(controlUser()||{}),reqAll=state.leaveRequests||[],stsAll=state.workStatuses||[],req=dashLeaveBroad?reqAll:reqAll.filter(x=>rowEmployeeMatch(x,dashIds)),sts=dashLeaveBroad?stsAll:stsAll.filter(x=>rowEmployeeMatch(x,dashIds)),today=";
    if (!source.includes(old)) throw new Error(`Dashboard leave scope insertion point was not found in ${basename(file)}.`);
    source = source.replace(old, next);
  }

  const callAnchor = "    paginateTable('dashboardBody',true);\n    requestAnimationFrame(renderDashboardCharts);";
  const callNext = "    paginateTable('dashboardBody',true);\n    applyDashboardAnalyticsAccess(monthRows,a,d);\n    requestAnimationFrame(renderDashboardCharts);";
  if (source.includes(callAnchor)) source = source.replace(callAnchor, callNext);
  else if (!source.includes('applyDashboardAnalyticsAccess(monthRows,a,d);')) throw new Error(`Dashboard RBAC call site was not found in ${basename(file)}.`);

  if (source !== original) { writeFileSync(file, source, 'utf8'); changed++; }
  console.log(`[dashboard-rbac] ${basename(file)} role-scoped-analytics=enabled`);
}
console.log(`[dashboard-rbac] verified ${targets.length} runtime file(s); ${changed} file(s) updated.`);
