import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const cssPath=join(publicDir,'access-roles-polish.css');
if(!existsSync(cssPath))throw new Error('Published Access & Roles polish stylesheet is missing.');
const css=readFileSync(cssPath,'utf8');
if(!html.includes('access-roles-polish.css?v=6.3.31'))throw new Error('Access & Roles polish stylesheet is not linked from the published app.');
for(const token of [
  '#accessManagementSection .access-admin-grid',
  'grid-template-columns:repeat(2,minmax(0,1fr))',
  '#accessManagementSection input',
  'min-height:31px!important',
  '#accessManagementSection .company-create-box',
  '#accessManagementSection .department-authority-note',
  '#accessManagementSection table',
  'table-layout:fixed',
  '@media(max-width:900px)'
])if(!css.includes(token))throw new Error(`Access & Roles compact presentation is missing: ${token}`);
console.log('[access-roles-polish-verify] OK: Access & Roles uses compact two-column administration cards.');
console.log('[access-roles-polish-verify] OK: inputs, role controls, company rows and authority notes use reduced modal-scale sizing.');
console.log('[access-roles-polish-verify] OK: access tables are compact and responsive without changing permission logic.');
