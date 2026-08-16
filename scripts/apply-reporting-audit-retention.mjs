import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-hub-compact-reporting.css'),runtime=resolve(root,'scripts/reporting-audit-retention-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Reporting/audit/compact Hub assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'department-hub-compact-reporting.css'),readFileSync(css,'utf8'),'utf8');

const reportGenerator=`<section class="panel report-generator-panel" id="systemReportGenerator"><div class="report-generator-head"><div><span class="section-kicker">Live system reporting</span><h3>Generate a report</h3><p>Create governed reports directly from the live data available to your authority. Generated files are stored in Supabase before download.</p></div><span class="status-badge success"><i></i> Live data</span></div><div class="report-generator-controls"><label>Report<select id="systemReportType"></select></label><label>Period<select id="systemReportPeriod"><option value="selected">Selected reporting month</option><option value="all">All available periods</option></select></label><label>Format<select id="systemReportFormat"><option value="excel">Microsoft Excel (.xls)</option><option value="pdf">PDF (.pdf)</option><option value="word">Microsoft Word (.doc)</option></select></label><button type="button" class="btn primary small report-generate-button" id="systemReportGenerate">Generate &amp; download</button></div><div class="report-format-note">Report availability follows role and functional authority. Payroll and audit datasets remain restricted.</div><div class="report-generator-preview" id="systemReportPreview"><div class="table-empty"><b>Select a report</b><span>A preview will appear here.</span></div></div></section>`;

const auditorSuite=`<section class="panel advanced-audit-suite" id="advancedAuditorSuite" hidden><div class="advanced-audit-head"><div><span class="section-kicker">Internal Auditor only</span><h3>Advanced System &amp; Data Audit</h3><p>Independent read-only tests across employee masters, payroll, work evidence, recovery time, projects, deterministic controls, access and segregation-of-duties indicators.</p></div><div class="auditor-private-note"><b>Restricted workspace</b><br>Visible only when the signed-in account resolves to Internal Auditor authority.</div></div><div class="advanced-audit-toolbar"><label>Audit scope<select id="advancedAuditScope"><option value="ALL">Full system</option><option value="PAYROLL">Payroll</option><option value="EMPLOYEES">Employee master</option><option value="WORK">Work evidence</option><option value="TIME">Recovery time</option><option value="PROJECTS">Projects</option><option value="CONTROLS">System controls &amp; access</option><option value="RECOVERY">Recovery assurance</option></select></label><button type="button" class="btn primary small" id="runAdvancedAuditorAudit">Run advanced audit</button><div><select id="advancedAuditFormat" aria-label="Audit export format"><option value="excel">Excel</option><option value="pdf">PDF</option><option value="word">Word</option></select><button type="button" class="btn ghost small" id="exportAdvancedAuditorFindings">Export findings</button></div></div><div class="advanced-audit-kpis" id="advancedAuditKpis"></div><div class="table-wrap wide"><table><thead><tr><th>Scope</th><th>Control</th><th>Record</th><th>Finding</th><th>Risk</th><th>Required action</th></tr></thead><tbody id="advancedAuditFindingsBody"></tbody></table></div></section>`;

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-hub-compact-reporting\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./department-hub-compact-reporting.css?v=6.3.43" />';
  if(s.includes('<link rel="stylesheet" href="./department-social-hub-fit.css?v=6.3.42" />'))s=s.replace('<link rel="stylesheet" href="./department-social-hub-fit.css?v=6.3.42" />','<link rel="stylesheet" href="./department-social-hub-fit.css?v=6.3.42" />\n'+link);
  else s=s.replace('</head>',link+'\n</head>');
  if(!s.includes('id="systemReportGenerator"')){const anchor='<div class="report-card-grid" id="reportCardGrid">';if(!s.includes(anchor))throw new Error(`Report card anchor missing in ${basename(file)}.`);s=s.replace(anchor,reportGenerator+'\n            '+anchor);}
  if(!s.includes('id="advancedAuditorSuite"')){const anchor='<div class="kpi-grid compact" id="recoveryAuditKpis"></div>';if(!s.includes(anchor))throw new Error(`Audit KPI anchor missing in ${basename(file)}.`);s=s.replace(anchor,auditorSuite+'\n          '+anchor);}
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[reporting-audit-retention] ${basename(file)} compact-hub=enabled report-generator=enabled auditor-suite=hidden-by-default`);
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8');
  if(!s.includes('Assurance Regent v6.3.43 — governed multi-format reports')){const anchor='  async function renderReports(){';if(!s.includes(anchor))throw new Error(`Reports runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon.trimEnd()+'\n\n'+anchor);}
  const reportTail="$('reportOnboardingMetric').textContent=`${engine.state.onboarding.filter(o=>o.status!=='Complete').length} in progress`;\n  }";
  if(s.includes(reportTail))s=s.replace(reportTail,"$('reportOnboardingMetric').textContent=`${engine.state.onboarding.filter(o=>o.status!=='Complete').length} in progress`;await renderReportGenerator();\n  }");
  else if(!s.includes("await renderReportGenerator();\n  }"))throw new Error(`renderReports integration anchor missing in ${basename(file)}.`);
  const auditTail="paginateTable('recoveryAuditEventsBody',true);}";
  if(s.includes(auditTail)&&!s.includes("paginateTable('recoveryAuditEventsBody',true);renderAdvancedAuditorTools();}"))s=s.replace(auditTail,"paginateTable('recoveryAuditEventsBody',true);renderAdvancedAuditorTools();}");
  if(s.includes('bindCompany(); bindPeopleOps();'))s=s.replace('bindCompany(); bindPeopleOps();','bindCompany(); bindReportingAuditRetentionUi(); bindPeopleOps();');
  else if(!s.includes('bindReportingAuditRetentionUi();'))throw new Error(`Boot binding anchor missing in ${basename(file)}.`);
  for(const token of ['REPORT_CATALOG','reportExcelBlob','reportPdfBlob','reportWordBlob','createGovernedReport','advancedAuditorAllowed','advancedAuditorFindings','advancedAuditorSuite','bindReportingAuditRetentionUi'])if(!s.includes(token))throw new Error(`Reporting/audit runtime missing ${token} in ${basename(file)}.`);
  if(!s.includes("reportAuthority()==='AUDITOR'"))throw new Error(`Internal Auditor restriction missing in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[reporting-audit-retention] ${basename(file)} excel-pdf-word=enabled auditor-only=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
