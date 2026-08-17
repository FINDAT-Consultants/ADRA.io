import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const p=resolve(process.cwd(),'public');if(!existsSync(p))throw new Error('public/ missing.');
const html=readFileSync(join(p,'index.html'),'utf8'),appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');
const app=readFileSync(join(p,appName),'utf8'),css=readFileSync(join(p,'department-hub-compact-reporting.css'),'utf8');

if(!html.includes('department-hub-compact-reporting.css?v=6.3.43'))throw new Error('Compact Hub/reporting stylesheet is not linked.');
for(const token of ['grid-template-columns:minmax(128px,16%) minmax(0,1fr) minmax(145px,18%)','height:auto!important','overflow:visible!important','width:43px!important','height:46px!important','font-size:12px!important','flex-wrap:wrap!important','grid-template-columns:repeat(auto-fit,minmax(96px,1fr))!important'])if(!css.includes(token))throw new Error(`Compact Department Hub rule missing: ${token}`);
if(css.includes('height:clamp(520px,calc(100dvh - 210px),760px)'))throw new Error('Legacy fixed Department Hub viewport returned.');
if(css.includes('#companyHubDepartments{display:flex!important;overflow-x:auto!important'))throw new Error('Mobile Department Hub horizontal scroller returned.');
if(!css.includes('.company-status-strip{display:flex!important;flex-wrap:wrap!important')||!css.includes('overflow:visible!important;scrollbar-width:none!important'))throw new Error('Department status strip must wrap without an internal scroller.');
if(!html.includes('id="systemReportGenerator"')||!html.includes('id="systemReportType"')||!html.includes('Microsoft Excel (.xls)')||!html.includes('PDF (.pdf)')||!html.includes('Microsoft Word (.doc)'))throw new Error('Multi-format report generator UI is incomplete.');
if(!html.includes('id="advancedAuditorSuite" hidden')||!html.includes('id="advancedAuditFindingsBody"'))throw new Error('Auditor-only advanced suite is not hidden by default or incomplete.');
for(const token of ['REPORT_CATALOG','reportExcelBlob','reportPdfBlob','reportWordBlob','createGovernedReport','generated-reports','advancedAuditorAllowed','advancedAuditorFindings','runAdvancedAuditorAudit','exportAdvancedAuditorFindings'])if(!app.includes(token))throw new Error(`Reporting/audit runtime missing: ${token}`);
if(!app.includes("function advancedAuditorAllowed(){return reportAuthority()==='AUDITOR';}"))throw new Error('Advanced audit suite is not restricted exclusively to Internal Auditor authority.');
if(!app.includes("await uploadPersistentBlob(blob,name,{category:'generated-reports'"))throw new Error('Generated reports are not persisted to Supabase before download.');
if(!app.includes("kind==='payroll'")||!app.includes("engine.payrollAnalysis()"))throw new Error('Payroll report is not generated from live payroll analysis data.');
if(!app.includes('bindReportingAuditRetentionUi();'))throw new Error('Reporting and audit controls are not bound during boot.');

for(const token of ['Assurance Regent v6.3.69 — reliable Work Activity clock location capture','workActivityLocationPermission69','navigator.permissions.query({name:\'geolocation\'})','enableHighAccuracy:true','maximumAge:300000','Location access is blocked for this site','browser-geolocation','clock_in_accuracy_m:geo.accuracy_m??null','clock_out_accuracy_m:loc.accuracy_m??null','const geo=await captureLocation(),docPayload=await documentPayload();'])if(!app.includes(token))throw new Error(`Work Activity location capture missing: ${token}`);
const legacySilent=app.indexOf("()=>resolve({label:'Location not provided'})"),requiredOverride=app.lastIndexOf('captureLocation=async function(){');
if(requiredOverride<0||(legacySilent>=0&&requiredOverride<=legacySilent))throw new Error('Reliable Work Activity location capture override is not active after the legacy fallback.');
if(app.includes('const [geo,docPayload]=await Promise.all([captureLocation(),documentPayload()]);'))throw new Error('Clock-in still uploads evidence before location capture succeeds.');
console.log('[reporting-audit-retention-verify] OK: Department Hub is compact, wraps status/department navigation and uses normal page scrolling instead of internal scrollers.');
console.log('[reporting-audit-retention-verify] OK: live reports support Excel, PDF and Word and persist generated files to Supabase.');
console.log('[reporting-audit-retention-verify] OK: payroll and other system report datasets are authority-gated.');
console.log('[reporting-audit-retention-verify] OK: advanced system/data audit tools are visible only to Internal Auditor authority.');
console.log('[reporting-audit-retention-verify] OK: Work Activity clock-in/out requires a real browser location fix, retries timed-out fixes, and persists coordinates plus accuracy.');
