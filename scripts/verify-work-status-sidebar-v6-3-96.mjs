import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const files=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))files.push(join(publicDir,name));
for(const file of files.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['WORK_STATUS_SIDEBAR_SCHEMA96','workStatusAllowed95=function(){return Boolean(controlUser());}','Work Status','switchView(WORK_STATUS_VIEW95)','nav.hidden=!Boolean(controlUser())'])if(!source.includes(token))throw new Error(`v6.3.96 verification failed: ${token} missing from ${file}`);
  if(/allowed\.has\('leave'\)\|\|allowed\.has\(WORK_STATUS_VIEW95\)/u.test(source.split('WORK_STATUS_SIDEBAR_SCHEMA96').pop()||''))throw new Error('Work Status v6.3.96 must not depend on Leave RBAC visibility.');
}
console.log('[verify-work-status-sidebar-v96] PASS visible-for-every-signed-in-user independent-of-leave-permission');
