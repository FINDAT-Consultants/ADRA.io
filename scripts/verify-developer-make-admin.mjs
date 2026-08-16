import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const publicDir=resolve(process.cwd(),'public');if(!existsSync(publicDir))throw new Error('public/ missing.');
const html=readFileSync(join(publicDir,'index.html'),'utf8');const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');const app=readFileSync(join(publicDir,appName),'utf8');
for(const id of ['accessUserSelect','accessRoleSelect','accessCompanySelect','accessPosition','accessDepartment','accessSupervisoryRole'])if(html.includes(`id="${id}"`))throw new Error(`Legacy Access & Roles field still rendered: ${id}`);
for(const id of ['developerMakeAdminControls','developerMakeAdminUser','developerMakeAdminBtn','developerAccountControls'])if(!html.includes(`id="${id}"`))throw new Error(`Required Access & Roles control missing: ${id}`);
if(!html.includes('Make administrator')||!html.includes('Make admin')||!html.includes('User / username'))throw new Error('Make administrator copy is incomplete.');
for(const token of ['function renderDeveloperMakeAdminControl(','function developerMakeAdminUi()','assurance_regent_browser_developer_make_admin',"controlUser()?.role!=='Developer'","nav.dataset.permissionHidden=isDev?'false':'true'","role==='Employee'&&status==='APPROVED'"])if(!app.includes(token))throw new Error(`Developer Make administrator runtime missing: ${token}`);
console.log('[make-admin-verify] OK: legacy Access & Roles authority fields are removed.');
console.log('[make-admin-verify] OK: Make administrator and Create approved account are the compact Access & Roles controls.');
console.log('[make-admin-verify] OK: Make administrator is Developer-only, lists active approved company Employees, and uses the dedicated governed RPC.');
