import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
if(!existsSync(publicDir))throw new Error('public/ directory is missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');
const inboxCssPath=join(publicDir,'work-inbox.css');
if(!existsSync(inboxCssPath))throw new Error('Published Inbox stylesheet is missing.');
const inboxCss=readFileSync(inboxCssPath,'utf8');

for(const token of [
  'v6.3.29 — internal communications are Messages-only',
  'function isInternalCommunicationItem(row)',
  'function isInternalMessageDocument(row)',
  'function isInternalMessageReview(row)',
  "rows=(c.notifications||[]).filter(x=>!isInternalCommunicationItem(x))",
  "filter(d=>!isInternalMessageDocument(d))",
  "filter(r=>!isInternalMessageReview(r))",
  "!isInternalCommunicationItem(x)&&['task','review','account_approval','leave_approval','recruitment_application']",
  "!isInternalMessageDocument(x)&&x.status==='PENDING_REVIEW'",
  "(c.reviews||[]).filter(x=>!isInternalMessageReview(x)).length"
])if(!app.includes(token))throw new Error(`Messages-only isolation is missing: ${token}`);

const segment=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);if(a<0||b<a)throw new Error(`Could not inspect ${start}.`);return app.slice(a,b);};
const notifications=segment('  function renderNotificationsPane(){','  async function completeControlTask');
const documents=segment('  function renderDocumentsPane(){','  async function openControlDocument');
const reviews=segment('  function renderReviewsPane(){','  async function runControlReview');
const settings=segment('  function renderSettingsPane(){','  function renderProfilePane');
const profile=segment('  function renderProfilePane(){','  async function saveControlProfile');

if(notifications.includes("['Messages',counts.message]")||notifications.includes("['AI advice',counts.advisor]"))throw new Error('Notifications still expose Messages or AI advisory summary cards.');
if(notifications.includes('unread messages and useful AI advice'))throw new Error('Notifications still advertise private messages or AI advisories.');
if(!documents.includes('!isInternalMessageDocument(d)'))throw new Error('Documents can still surface private-message attachments.');
if(!reviews.includes('!isInternalMessageReview(r)'))throw new Error('Reviews can still surface private-message content or attachments.');
for(const [name,source] of [['Settings',settings],['Profile',profile]]){
  if(source.includes('state.internalInbox')||source.includes('assurance_regent_browser_message_')||source.includes('renderInternalInbox('))throw new Error(`${name} is coupled to internal message data.`);
}

const dock=segment('  function renderControlDock(){','  function openControlPanel');
if(dock.includes("['advisor','task'"))throw new Error('Notifications badge still counts AI/message advisory items.');
if(!dock.includes("['notificationBadge',n],['inboxBadge',m]"))throw new Error('Messages unread badge is not independently assigned to the Messages icon.');

if(!/\.inbox-control-pane\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/iu.test(inboxCss)){
  throw new Error('Inactive Messages pane can override the hidden attribute and leak into other dock panels.');
}

console.log('[messages-only-verify] OK: internal messages and AI advisories are visible only in Messages.');
console.log('[messages-only-verify] OK: Notifications excludes message/advisor cards and counts.');
console.log('[messages-only-verify] OK: message attachments do not surface in Documents or Reviews.');
console.log('[messages-only-verify] OK: Settings and Profile are not coupled to Inbox data.');
console.log('[messages-only-verify] OK: inactive Messages pane is force-hidden and cannot visually leak into another dock panel.');
