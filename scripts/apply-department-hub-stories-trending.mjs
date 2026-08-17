import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-hub-stories-trending.css'),runtime=resolve(root,'scripts/department-hub-stories-trending-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Department Hub stories/trending assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'department-hub-stories-trending.css'),readFileSync(css,'utf8'),'utf8');

function patchHtml(file){let s=readFileSync(file,'utf8'),before=s;s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-hub-stories-trending\.css\?v=[^"]+" \/>/gu,'');const link='  <link rel="stylesheet" href="./department-hub-stories-trending.css?v=6.3.62" />';const anchor='<link rel="stylesheet" href="./department-hub-status-upload.css?v=6.3.61" />';if(s.includes(anchor))s=s.replace(anchor,anchor+'\n'+link);else s=s.replace('</head>',link+'\n</head>');if(s!==before)writeFileSync(file,s,'utf8');console.log(`[department-hub-stories-trending] ${basename(file)} status-slideshow=enabled project-news-page-size=2 trending=enabled`);}

function patchApp(file){let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();
  if(s.includes('const COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=3;'))s=s.replace('const COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=3;','const COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=2;');
  else if(!s.includes('const COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=2;'))throw new Error(`Project News page-size constant missing in ${basename(file)}.`);
  const block=/  \/\* Assurance Regent v6\.3\.62 — slideshow statuses and algorithmic trending START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.62 — slideshow statuses and algorithmic trending END \*\//u;
  if(block.test(s))s=s.replace(block,addon);else{const anchor='  function renderExtendedProfileFields()';if(!s.includes(anchor))throw new Error(`Stories/trending runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon+'\n'+anchor);}
  const oldHook='renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();}';
  const newHook='renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();renderCompanyHubStoriesTrending62();}';
  if(s.includes(oldHook))s=s.replace(oldHook,newHook);else if(!s.includes(newHook))throw new Error(`Stories/trending render hook missing in ${basename(file)}.`);
  for(const token of ['COMPANY_HUB_PROJECT_NEWS_PAGE_SIZE=2','COMPANY_HUB_STATUS_MAX_ATTACHMENTS62=4','data-company-story-effect','data-company-story-slide-seconds','companyHubStorySlideshow','companyHubInitStorySlideshow62','companyHubFitStoryText62','assurance_regent_browser_department_social_view','assurance_regent_browser_department_social_trending','companyHubBindPostViewObserver62','companyHubRenderTrending62','renderCompanyHubStoriesTrending62'])if(!s.includes(token))throw new Error(`Department Hub stories/trending runtime missing ${token} in ${basename(file)}.`);
  if(!s.includes(newHook))throw new Error(`Department Hub stories/trending render chain is not connected in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');console.log(`[department-hub-stories-trending] ${basename(file)} story-text=no-scroll slideshow=music-effects project-news=2 trending=viewership-momentum`);
}
for(const file of htmlTargets)patchHtml(file);for(const file of appTargets.filter(existsSync))patchApp(file);
