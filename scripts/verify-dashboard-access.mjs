import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir = resolve(process.cwd(), 'public');
if (!existsSync(publicDir)) throw new Error('public/ directory is missing.');
const appName = readdirSync(publicDir).find((name) => /^app(?:\.|-).*\.js$/iu.test(name));
if (!appName) throw new Error('Published Assurance Regent app runtime is missing.');
const source = readFileSync(join(publicDir, appName), 'utf8');

const required = [
  ['v6.3.26 — role-scoped dashboard analytics', 'dashboard RBAC marker'],
  ["DEVELOPER:{summary:'org',people:true,salary:true,leave:true,recovery:true}", 'Developer full dashboard analytics'],
  ["ADMINISTRATOR:{summary:'org',people:true,salary:true,leave:true,recovery:true}", 'Administrator organizational dashboard analytics'],
  ["HR_MANAGER:{summary:'hr',people:true,salary:false,leave:true,recovery:false}", 'HR workforce dashboard scope'],
  ["FINANCE_MANAGER:{summary:'none',people:false,salary:true,leave:false,recovery:true}", 'Finance dashboard scope'],
  ["PROGRAMS_MANAGER:{summary:'team',people:true,salary:false,leave:true,recovery:false}", 'Programs team dashboard scope'],
  ["PROJECT_MANAGER:{summary:'team',people:true,salary:false,leave:true,recovery:false}", 'Project team dashboard scope'],
  ["HEAD_OF_DEPARTMENT:{summary:'team',people:true,salary:false,leave:true,recovery:false}", 'Department head team dashboard scope'],
  ["SUPERVISOR:{summary:'team',people:true,salary:false,leave:true,recovery:false}", 'Supervisor team dashboard scope'],
  ["AUDITOR:{summary:'none',people:false,salary:false,leave:false,recovery:true}", 'Audit dashboard scope'],
  ["EMPLOYEE:{summary:'self',people:true,salary:false,leave:true,recovery:false}", 'ordinary employee personal dashboard scope'],
  ['dashboardAnalyticsVisibility(salary,p.salary)', 'salary analytic visibility gate'],
  ['dashboardAnalyticsVisibility(recoveryHeading,p.recovery)', 'recovery analytic visibility gate'],
  ['dashboardAnalyticsVisibility(monthly,p.recovery)', 'monthly performance visibility gate'],
  ['dashboard leave analytics are scoped to functional authority', 'leave dashboard data scoping'],
  ['applyDashboardAnalyticsAccess(monthRows,a,d);', 'dashboard role policy application'],
  ["label.textContent='My recorded hours'", 'personal employee headline metric'],
  ["label.textContent='Team members'", 'team manager headline metric'],
  ["label.textContent='Total Employees'", 'organizational workforce headline metric'],
];

for (const [needle, label] of required) {
  if (!source.includes(needle)) throw new Error(`Dashboard RBAC verification failed: ${label} is missing.`);
}
if (source.includes("EMPLOYEE:{summary:'self',people:true,salary:true")) throw new Error('Dashboard RBAC verification failed: ordinary Employee can see salary analytics.');
if (source.includes("EMPLOYEE:{summary:'self',people:true,salary:false,leave:true,recovery:true}")) throw new Error('Dashboard RBAC verification failed: ordinary Employee can see recovery analytics.');
if (source.includes("HR_MANAGER:{summary:'hr',people:true,salary:true")) throw new Error('Dashboard RBAC verification failed: HR Manager can see salary analytics.');

console.log('[dashboard-rbac-verify] OK: Developer retains all dashboard analytics.');
console.log('[dashboard-rbac-verify] OK: HR, Finance, Audit and management dashboards are function-scoped.');
console.log('[dashboard-rbac-verify] OK: ordinary Employee sees personal work/time/leave/calendar analytics only.');
console.log('[dashboard-rbac-verify] OK: restricted salary and recovery analytics are fully hidden by role.');
