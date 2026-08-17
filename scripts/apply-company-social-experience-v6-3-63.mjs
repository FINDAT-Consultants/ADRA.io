import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'company-social-experience-v6-3-63.css'),runtime=resolve(root,'scripts/company-social-experience-v6-3-63-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Company social experience v6.3.63 assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'company-social-experience-v6-3-63.css'),readFileSync(css,'utf8'),'utf8');

function patchHtml(file){let s=readFileSync(file,'utf8'),before=s;s=s.replace(/\s*<link rel="stylesheet" href="\.\/company-social-experience-v6-3-63\.css\?v=[^"]+" \/>/gu,'');const link='  <link rel="stylesheet" href="./company-social-experience-v6-3-63.css?v=6.3.63" />',anchor='<link rel="stylesheet" href="./department-hub-stories-trending.css?v=6.3.62" />';if(s.includes(anchor))s=s.replace(anchor,anchor+'\n'+link);else s=s.replace('</head>',link+'\n</head>');if(s!==before)writeFileSync(file,s,'utf8');console.log(`[company-social-experience] ${basename(file)} trend-chart=compact status-carousel=horizontal developer-company-selector=enabled`);}

function patchApp(file){let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();const block=/  \/\* Assurance Regent v6\.3\.63 — compact trend chart, status carousel and developer company selector START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.63 — compact trend chart, status carousel and developer company selector END \*\//u;if(block.test(s))s=s.replace(block,addon);else{const anchor='  function renderExtendedProfileFields()';if(!s.includes(anchor))throw new Error(`v6.3.63 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,addon+'\n'+anchor);}for(const token of ['companyHubRenderTrending63','companyHubTrendChart63','trendSeries','companyHubRenderStories63','data-company-status-scroll63','data-company-status-picker-toggle63','data-company-status-search63','developerCompanySelectorOpen63','data-developer-company-open63','data-developer-company-list63','renderDeveloperCompanySelector63','renderCompanyWorkspaceBase63'])if(!s.includes(token))throw new Error(`v6.3.63 runtime missing ${token} in ${basename(file)}.`);if(s!==before)writeFileSync(file,s,'utf8');console.log(`[company-social-experience] ${basename(file)} compact-trend-sparkline=enabled status-browse=carousel+search developer-company-entry=cards-first`);}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
