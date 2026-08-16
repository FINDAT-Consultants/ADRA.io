import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const cssPath=join(publicDir,'company-controls.css');
if(!existsSync(cssPath))throw new Error('Published Company Controls stylesheet is missing.');
const css=readFileSync(cssPath,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');

if(html.includes('id="accessSupervisor"'))throw new Error('The redundant Access & Roles Supervisor entry field still exists.');
if(html.includes('id="developerCompanyCreate"')||html.includes('id="developerCompanyDirectoryWrap"')||html.includes('id="developerCompanyDirectory"'))throw new Error('Legacy company controls are still mounted inside Access & Roles HTML.');
if(app.includes("$('accessSupervisor')"))throw new Error('Runtime still reads the removed Access & Roles Supervisor field.');

for(const token of [
  "table:'__companies__'",
  "label:'Company controls'",
  'dataCompanyPageSize=5',
  'function renderDataCompanyControls(){',
  'function dataCompanyWorkforceBand(',
  'data-company-switch',
  'data-company-open',
  'Service shutdown requirements',
  'assurance_regent_browser_admin_company_access',
  'assurance_regent_browser_message_send',
  'Send internal company message'
])if(!app.includes(token))throw new Error('Company Controls runtime is missing: '+token);

if(app.includes('company-member-directory')||app.includes('connected user'))throw new Error('Legacy company cards still expose user names/counts.');
if(!app.includes("p_supervisor:target?.supervisor||''"))throw new Error('Saving Access & Roles must preserve historical supervisor data after removing the field.');
if(app.includes("['people','User access'],['authority','Roles'],['company','Company'],['approval','Approvals']"))throw new Error('Access & Roles still advertises a Company Controls legend.');

for(const token of ['.company-control-grid','.company-control-card','.company-service-toggle','.company-control-detail','.company-controls-pagination','.company-workforce-band'])if(!css.includes(token))throw new Error('Company Controls CSS is missing: '+token);

console.log('[company-controls-verify] OK: redundant Supervisor entry field is removed while stored reporting-line data is preserved.');
console.log('[company-controls-verify] OK: Company Controls moved out of Access & Roles into Developer Data Controls.');
console.log('[company-controls-verify] OK: company cards show company identity/contact/workforce bands without employee names or exact user counts.');
console.log('[company-controls-verify] OK: service toggle, Open detail panel, shutdown guidance, internal messaging and five-company pagination are wired.');
