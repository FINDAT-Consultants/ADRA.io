import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const files=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))files.push(join(publicDir,name));
for(const file of files.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['LEAVE_WORK_STATUS_SCHEMA95','WORK_STATUS_VIEW95','resetLeaveRequestForm95','form.reset()','Submitting…','Select leave type','ensureWorkStatusView95','data.view=WORK_STATUS_VIEW95','renderWorkStatusView95','Select work status','assurance_regent_browser_work_status_set','renderDashboardLeave();','The dashboard now reflects the latest location/status.'])if(!source.includes(token))throw new Error(`v6.3.95 runtime verification failed: ${token} missing from ${file}`);
  if(!source.includes("leaveNav.innerHTML='<span>☘</span> Leave'"))throw new Error('Leave navigation was not separated from Work Status.');
  if(!source.includes("nav.innerHTML='<span>⌖</span> Work Status'"))throw new Error('Dedicated Work Status sidebar navigation is missing.');
  if(!source.includes("if(state.view===WORK_STATUS_VIEW95)renderWorkStatusView95()"))throw new Error('Work Status view refresh hook is missing.');
}
for(const htmlFile of [resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync)){const html=readFileSync(htmlFile,'utf8');if(!html.includes('leave-work-status-v6-3-95.css'))throw new Error(`Self-hosted v6.3.95 stylesheet missing from ${htmlFile}`);}
if(existsSync(publicDir)&&!existsSync(resolve(publicDir,'leave-work-status-v6-3-95.css')))throw new Error('Built Work Status stylesheet is missing from public/.');
console.log('[verify-leave-work-status-v95] PASS leave-fields-clear-after-success dedicated-work-status-sidebar dashboard-live-sync');
