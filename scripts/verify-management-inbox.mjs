import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),index=resolve(publicDir,'index.html');
if(!existsSync(index))throw new Error('public/index.html is missing.');
const html=readFileSync(index,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
const agentName=readdirSync(publicDir).find(n=>/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(n));
if(!appName||!agentName)throw new Error('Published app or Jivan runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8'),agent=readFileSync(join(publicDir,agentName),'utf8');

const notif=html.indexOf('data-control-panel="notifications"'),messages=html.indexOf('data-control-panel="messages"'),docs=html.indexOf('data-control-panel="documents"');
if(!(notif>=0&&messages>notif&&docs>messages))throw new Error('Messages dock button is not between Notifications and Documents.');
for(const token of ['id="inboxBadge"','id="controlPaneMessages"','id="internalMessageForm"','id="inboxRecipientSearch"','id="inboxRecipientSelect"','id="inboxAttachmentFile"','id="internalInboxList"'])if(!html.includes(token))throw new Error(`Internal inbox UI is missing ${token}.`);
if(!html.includes('work-inbox.css?v=6.3.27'))throw new Error('Internal inbox stylesheet is not linked.');

const dashStart=html.indexOf('id="view-dashboard"'),dashEnd=html.indexOf('id="view-company"'),workStart=html.indexOf('id="view-work"'),workEnd=html.indexOf('id="view-time"');
const dashboard=html.slice(dashStart,dashEnd),work=html.slice(workStart,workEnd);
for(const token of ['id="wacManagementAnalytics"','id="mtsTopWorkersChart"','id="mtsDailyAnalytics"','id="mtsDepartmentChart"','id="mtsProjectPerformanceChart"','id="mtsEmployeeMonth"','id="mtsJobsList"','id="mtsOvertimeList"'])if(!dashboard.includes(token))throw new Error(`Dashboard is missing moved WAC analytic ${token}.`);
for(const token of ['mts-analytics-grid','mts-insight-grid','mts-message-grid','mtsMessageForm','mtsMessageList'])if(work.includes(token))throw new Error(`Work Activity still contains management/inbox UI: ${token}.`);
if(!work.includes('id="mtsTable"'))throw new Error('Operational Work Activity records table was removed.');

for(const token of [
  'v6.3.27 — management WAC analytics + private internal inbox',
  "['DEVELOPER','CEO','ADMINISTRATOR','HR_MANAGER'].includes(authority)",
  'assurance_regent_browser_message_bundle',
  'assurance_regent_browser_message_send',
  'assurance_regent_browser_message_mark_read',
  'assurance_regent_browser_message_ai_self',
  'renderDashboardWacManagement(monthRows);',
  "['notificationBadge',n],['inboxBadge',m]",
  "state.controlPanel==='messages'",
  "queueAiInboxMessage(value,label)"
])if(!app.includes(token))throw new Error(`Published app is missing management/inbox behavior: ${token}.`);
if(app.includes("['message','advisor','task','review'"))throw new Error('Legacy internal messages are still counted in the Notifications badge.');
if(!agent.includes('data-control-pane="messages"'))throw new Error('Jivan overlap guard does not recognize the Messages pane.');

console.log(`[management-inbox-verify] OK: ${basename(index)} moves management WAC analytics to Dashboard.`);
console.log('[management-inbox-verify] OK: ordinary Work Activity retains operational records without management analytics or legacy message cards.');
console.log('[management-inbox-verify] OK: Messages sits between Notifications and Documents with private recipients, unread badge, attachments and Jivan routing.');
console.log('[management-inbox-verify] OK: management analytics are limited to Developer, CEO/Administrator and HR Manager authority.');
