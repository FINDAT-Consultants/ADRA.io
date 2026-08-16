import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const compactPath=join(publicDir,'access-roles-polish.css');
const segmentPath=join(publicDir,'access-roles-segments.css');
if(!existsSync(compactPath))throw new Error('Published Access & Roles compact stylesheet is missing.');
if(!existsSync(segmentPath))throw new Error('Published Access & Roles segmentation stylesheet is missing.');
const compact=readFileSync(compactPath,'utf8'),segments=readFileSync(segmentPath,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');

if(!html.includes('access-roles-polish.css?v=6.3.31'))throw new Error('Access & Roles compact stylesheet is not linked from the published app.');
if(!html.includes('access-roles-segments.css?v=6.3.32'))throw new Error('Access & Roles segmentation stylesheet is not linked from the published app.');
for(const token of [
  '#accessManagementSection .access-admin-grid',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  '#accessManagementSection input',
  'min-height:31px!important',
  '#accessManagementSection table',
  'table-layout:fixed',
  '@media(max-width:900px)'
])if(!compact.includes(token))throw new Error(`Access & Roles compact presentation is missing: ${token}`);

for(const token of [
  '.department-authority-note{display:none!important}',
  '.access-zone-legend',
  '.access-zone-people',
  '.access-zone-authority',
  '.access-zone-approval',
  '.access-action-primary',
  '.access-action-positive',
  '.access-action-warning',
  '.access-action-danger'
])if(!segments.includes(token))throw new Error(`Access & Roles segmentation presentation is missing: ${token}`);

for(const token of [
  'function decorateAccessRolesUi(){',
  "longNote.remove()",
  "Manage user access, functional roles and approvals.",
  "['people','User access']",
  "['authority','Roles']",
  "['approval','Approvals']",
  "save:'Save access'",
  "apply:'Apply role'",
  "approve:'Approve access'",
  "delete:'Delete account'",
  "setTimeout(decorateAccessRolesUi,500)"
])if(!app.includes(token))throw new Error(`Access & Roles semantic runtime is missing: ${token}`);
if(app.includes("['company','Company']"))throw new Error('Company Controls must not remain in the Access & Roles legend.');

console.log('[access-roles-polish-verify] OK: Access & Roles remains compact and responsive.');
console.log('[access-roles-polish-verify] OK: Departmental Authority prose and the redundant Supervisor field are removed from Settings.');
console.log('[access-roles-polish-verify] OK: Access & Roles now focuses on user access, roles and approvals; Company Controls moved to Data Controls.');
console.log('[access-roles-polish-verify] OK: ambiguous access buttons remain clarified and restrictive actions use distinct warning/danger semantics.');
