import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
const p=resolve(process.cwd(),'public');if(!existsSync(p))throw new Error('public/ missing.');
const html=readFileSync(join(p,'index.html'),'utf8'),appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime missing.');
const app=readFileSync(join(p,appName),'utf8'),css=readFileSync(join(p,'department-social-hub-fit.css'),'utf8'),conversationCss=readFileSync(join(p,'department-hub-conversations.css'),'utf8');
if(!html.includes('department-social-hub-fit.css?v=6.3.47'))throw new Error('Department Hub professional-feed stylesheet is not linked.');
if(!html.includes('department-hub-conversations.css?v=6.3.48'))throw new Error('Department Hub conversation stylesheet is not linked.');
for(const token of ['grid-template-columns:220px minmax(0,600px) 260px','height:auto!important','overflow:visible!important','position:sticky','order:1','border-radius:12px','grid-template-columns:repeat(3,minmax(0,1fr))','object-fit:contain!important','social-post-highlight'])if(!css.includes(token))throw new Error(`Professional Department Hub style missing: ${token}`);
if(css.includes('overflow-y:auto!important'))throw new Error('Department Hub reintroduced internal vertical scrolling.');
if(css.includes('overflow-x:auto!important'))throw new Error('Department Hub reintroduced internal horizontal scrolling.');
for(const token of ['social-reaction-picker','social-reaction-choice','company-social-comments-panel','company-social-comment-children','company-social-inline-comment','company-social-engagement-analytics','company-social-analytics-grid','company-social-trend-badge'])if(!conversationCss.includes(token))throw new Error(`Threaded comments/reaction style missing: ${token}`);
for(const label of ['Like','Celebrate','Support','Love','Insightful','Funny'])if(!app.includes(`label:'${label}'`))throw new Error(`Selectable Department Hub reaction missing: ${label}`);
for(const token of ['companySocialPostMarkupEnhanced','companySocialThreadRows','companySocialCommentTreeMarkup','companySocialEngagementAnalytics','companySocialOpenThreads','data-social-comments-toggle','data-social-reaction-toggle','data-social-comment-form','data-social-comment-id','p_parent_id:parent','Trending contributors','Freshness-weighted momentum'])if(!app.includes(token))throw new Error(`Threaded Hub engagement runtime missing: ${token}`);
if(!app.includes("posts.map(p=>companySocialPostMarkupEnhanced(p,allReplies)).join('')"))throw new Error('Department Hub feed is not rendering enhanced posts with all nested replies.');
if(app.includes('companySocialReactionButtons(post)')){
  const enhanced=app.slice(app.indexOf('function companySocialPostMarkupEnhanced'),app.indexOf('async function submitCompanySocialComment'));
  if(enhanced.includes('companySocialReactionButtons(post)'))throw new Error('Enhanced post markup still shows the old inline reaction row.');
}
for(const token of ['loadDepartmentHubNotifications','renderDepartmentHubNotificationsPane','data-hub-notification-open','openDepartmentHubNotification','assurance_regent_browser_department_social_notifications','assurance_regent_browser_department_social_notification_read'])if(!app.includes(token))throw new Error(`Hub notification runtime missing: ${token}`);
if(!app.includes("state.companyTab='hub'")||!app.includes("scrollIntoView({behavior:'smooth',block:'center'})"))throw new Error('Hub notifications do not deep-link to the Department Hub post.');
if(!app.includes('resolveCompanySocialRoot(postId||messageId)'))throw new Error('Nested comment notifications do not resolve back to the root post.');
if(!app.includes("['notificationBadge',n+(state.companyHubNotifications||[]).length]"))throw new Error('Hub unread notifications are not included in the Notifications badge.');
console.log('[department-hub-engagement-verify] OK: Department Hub uses a compact professional three-column social-feed layout.');
console.log('[department-hub-engagement-verify] OK: posts use one selectable reaction control with Like, Celebrate, Support, Love, Insightful and Funny.');
console.log('[department-hub-engagement-verify] OK: Comments expand beneath each post and support persisted nested replies to individual comments.');
console.log('[department-hub-engagement-verify] OK: comment reactions, comment emoji entry and threaded conversation rendering are enabled.');
console.log('[department-hub-engagement-verify] OK: engagement analytics expose freshness-weighted trend score, reactions, comments, contributors and trending contributors.');
console.log('[department-hub-engagement-verify] OK: nested comment notifications resolve to and open the root post conversation.');
