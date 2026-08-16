import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-social-hub-fit.css'),runtime=resolve(root,'scripts/department-hub-engagement-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Department Hub engagement assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'department-social-hub-fit.css'),readFileSync(css,'utf8'),'utf8');
function patchHtml(file){let s=readFileSync(file,'utf8'),before=s;s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-social-hub-fit\.css\?v=[^"]+" \/>/gu,'');const link='  <link rel="stylesheet" href="./department-social-hub-fit.css?v=6.3.42" />\n';if(s.includes('<link rel="stylesheet" href="./department-social-hub.css?v=6.3.41" />'))s=s.replace('<link rel="stylesheet" href="./department-social-hub.css?v=6.3.41" />','<link rel="stylesheet" href="./department-social-hub.css?v=6.3.41" />\n'+link.trimEnd());else s=s.replace('</head>',link+'</head>');if(s!==before)writeFileSync(file,s,'utf8');console.log(`[department-hub-engagement] ${basename(file)} responsive-fit=enabled`);}
function patchApp(file){let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8');
  if(!s.includes('Assurance Regent v6.3.42 — Department Hub fit')){const anchor='  function renderExtendedProfileFields()';if(!s.includes(anchor))throw new Error(`Department Hub runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon.trimEnd()+'\n'+anchor);}
  if(s.includes("visibleReplies.map(companySocialReplyMarkup).join('')"))s=s.replace("visibleReplies.map(companySocialReplyMarkup).join('')","visibleReplies.map(r=>companySocialReplyMarkupEnhanced(r,post.id)).join('')");
  if(s.includes("$('companyHubInput').value='';$('companyHubFile').value='';"))s=s.replace("$('companyHubInput').value='';$('companyHubFile').value='';","$('companyHubInput').value='';$('companyHubInput').style.height='';$('companyHubFile').value='';");
  const bind=/  function bindAiCompanyHubUi\(\)\{[^\n]*\}/u;if(bind.test(s)){const block=s.match(bind)?.[0]||'';if(!block.includes('bindDepartmentHubEngagementUi()'))s=s.replace(bind,block.replace(/installEmojiButtons\(\);\}$/u,'installEmojiButtons();bindDepartmentHubEngagementUi();}'));}
  if(s.includes('mergeRecruitmentNotificationsIntoControl();renderControlDock();'))s=s.replace('mergeRecruitmentNotificationsIntoControl();renderControlDock();','mergeRecruitmentNotificationsIntoControl();await loadDepartmentHubNotifications();renderControlDock();');
  if(s.includes("await reloadLiveState();await loadMtsData();setSignInError('');"))s=s.replace("await reloadLiveState();await loadMtsData();setSignInError('');","await reloadLiveState();await loadMtsData();await loadDepartmentHubNotifications(true);setSignInError('');");
  if(s.includes("if(panel==='notifications')renderNotificationsPane();"))s=s.replace("if(panel==='notifications')renderNotificationsPane();","if(panel==='notifications'){renderNotificationsPane();renderDepartmentHubNotificationsPane();}");
  if(s.includes("['notificationBadge',n]"))s=s.replace("['notificationBadge',n]","['notificationBadge',n+(state.companyHubNotifications||[]).length]");
  for(const token of ['companySocialReplyMarkupEnhanced','data-social-comment-reply','loadDepartmentHubNotifications','renderDepartmentHubNotificationsPane','data-hub-notification-open','assurance_regent_browser_department_social_notifications','assurance_regent_browser_department_social_notification_read',"['notificationBadge',n+(state.companyHubNotifications||[]).length]"])if(!s.includes(token))throw new Error(`Department Hub engagement runtime missing ${token} in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[department-hub-engagement] ${basename(file)} comments=like-love-reply notifications=deep-link badge=enabled`);
}
for(const file of htmlTargets)patchHtml(file);for(const file of appTargets.filter(existsSync))patchApp(file);
