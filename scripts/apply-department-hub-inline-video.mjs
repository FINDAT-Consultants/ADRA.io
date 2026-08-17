import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-hub-inline-video.css'),runtime=resolve(root,'scripts/department-hub-inline-video-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Department Hub inline-video assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'department-hub-inline-video.css'),readFileSync(css,'utf8'),'utf8');

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-hub-inline-video\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./department-hub-inline-video.css?v=6.3.59" />';
  const anchor='<link rel="stylesheet" href="./department-hub-composer-fit.css?v=6.3.58" />';
  if(s.includes(anchor))s=s.replace(anchor,anchor+'\n'+link);
  else if(s.includes('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />'))s=s.replace('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />','<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />\n'+link);
  else s=s.replace('</head>',link+'\n</head>');
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-inline-video] ${basename(file)} inline-only=enabled viewport-autoplay=enabled`);
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();
  const oldVideoDecorator="for(const node of document.querySelectorAll('.company-social-media.video[data-company-social-media]')){if(node.querySelector('[data-company-inline-video]'))continue;const id=String(node.dataset.companySocialMedia||'');node.insertAdjacentHTML('beforeend',`<button type=\"button\" class=\"company-hub-inline-video-open\" data-company-inline-video=\"${esc(id)}\">⛶ <span>Open video player</span></button>`);}";
  const flatVideoDecorator="for(const node of document.querySelectorAll('.company-social-media.video[data-company-social-media]')){node.querySelectorAll('.company-hub-inline-video-open,[data-company-inline-video]').forEach(x=>x.remove());}";
  if(!s.includes(oldVideoDecorator)&&!s.includes(flatVideoDecorator))throw new Error(`Old Department Hub video-open decorator was not found in ${basename(file)}.`);
  s=s.replace(oldVideoDecorator,flatVideoDecorator);
  const oldVideoClick="const video=e.target.closest('[data-company-inline-video]');if(video){e.preventDefault();e.stopImmediatePropagation();openCompanyHubInlineViewer54(video.dataset.companyInlineVideo,'video',video);return;}";
  s=s.replace(oldVideoClick,'');

  const block=/  \/\* Assurance Regent v6\.3\.59 — LinkedIn-style inline Department Hub video START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.59 — LinkedIn-style inline Department Hub video END \*\//u;
  if(block.test(s))s=s.replace(block,addon);
  else{
    const runtimeAnchor='  function renderExtendedProfileFields()';
    if(!s.includes(runtimeAnchor))throw new Error(`Inline-video runtime anchor missing in ${basename(file)}.`);
    s=s.replace(runtimeAnchor,addon+'\n'+runtimeAnchor);
  }

  const renderOld='renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}';
  const renderNew='renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();renderCompanyHubInlineVideo59();}';
  if(s.includes(renderOld))s=s.replace(renderOld,renderNew);
  else if(!s.includes(renderNew))throw new Error(`Department Hub render hook missing in ${basename(file)}.`);

  const bind=/  function bindAiCompanyHubUi\(\)\{[^\n]*\}/u;
  if(!bind.test(s))throw new Error(`Department Hub binder missing in ${basename(file)}.`);
  let current=s.match(bind)?.[0]||'';
  if(!current.includes('bindCompanyHubInlineVideo59()'))current=current.slice(0,-1)+'bindCompanyHubInlineVideo59();}';
  s=s.replace(bind,current);

  for(const token of ['companyHubInlineVideos59','companyHubPrepareInlineVideo59','companyHubAutoplayBestVisibleVideo59','IntersectionObserver','intersectionRatio','companyHubPauseOtherInlineVideos59','renderCompanyHubInlineVideo59','bindCompanyHubInlineVideo59'])if(!s.includes(token))throw new Error(`Department Hub inline-video runtime missing ${token} in ${basename(file)}.`);
  if(s.includes('Open video player')||s.includes("openCompanyHubInlineViewer54(video.dataset.companyInlineVideo,'video',video)"))throw new Error(`Secondary Department Hub video player remains reachable in ${basename(file)}.`);
  if(!s.includes(renderNew)||!s.includes('bindCompanyHubInlineVideo59();'))throw new Error(`Department Hub inline-video hooks are not connected in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-inline-video] ${basename(file)} one-inline-video=enabled muted-viewport-autoplay=enabled offscreen-pause=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
