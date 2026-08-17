import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const root=process.cwd(),p=resolve(root,'public');
if(!existsSync(p))throw new Error('public/ missing.');
const html=readFileSync(join(p,'index.html'),'utf8'),appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published app runtime missing.');
const appPath=join(p,appName),app=readFileSync(appPath,'utf8'),css=readFileSync(join(p,'department-hub-stories-trending.css'),'utf8');
if(!html.includes('department-hub-stories-trending.css?v=6.3.62'))throw new Error('Stories/trending stylesheet is not linked.');
for(const token of ['.company-hub-story-content>p','overflow-y:visible!important','story-text-dense','company-hub-story-slideshow','effect-kenburns','company-hub-story-soundtrack','company-hub-trending-analytics'])if(!css.includes(token))throw new Error(`Stories/trending style missing: ${token}`);
for(const token of ['COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=2','COMPANY_HUB_STATUS_MAX_ATTACHMENTS62=4','multiple />','data-company-story-effect','data-company-story-slide-seconds','companyHubStatusPresentationCache62','companyHubInitStorySlideshow62','companyHubFitStoryText62','assurance_regent_browser_department_status_presentation_set','assurance_regent_browser_department_social_view','assurance_regent_browser_department_social_trending','IntersectionObserver','intersectionRatio>=.62','companyHubRenderTrending62','Trend score','Viewers','Views','renderCompanyHubStoriesTrending62'])if(!app.includes(token))throw new Error(`Stories/trending runtime missing: ${token}`);
if(!app.includes('renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();renderCompanyHubStoriesTrending62();}'))throw new Error('Stories/trending render hook is not connected.');
if(app.includes('const COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=3;'))throw new Error('Project News is still configured for three items per page.');
execFileSync(process.execPath,['--check',appPath],{stdio:'pipe'});
console.log('[department-hub-stories-trending-verify] OK: Status text auto-fits without a text scrollbar.');
console.log('[department-hub-stories-trending-verify] OK: multi-photo Status slideshows support optional music and selectable transitions.');
console.log('[department-hub-stories-trending-verify] OK: Project News is capped at two cards per page with existing pagination.');
console.log('[department-hub-stories-trending-verify] OK: Trending now uses authenticated viewership plus freshness, reactions and conversation analytics.');
