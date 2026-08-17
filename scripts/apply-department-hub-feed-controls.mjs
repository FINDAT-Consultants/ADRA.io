import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-hub-feed-controls.css'),runtime=resolve(root,'scripts/department-hub-feed-controls-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime))throw new Error('Department Hub feed-control assets are missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'department-hub-feed-controls.css'),readFileSync(css,'utf8'),'utf8');

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-hub-feed-controls\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./department-hub-feed-controls.css?v=6.3.55" />';
  if(s.includes('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />'))s=s.replace('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />','<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />\n'+link);
  else s=s.replace('</head>',link+'\n</head>');
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-feed-controls] ${basename(file)} composer=compact-horizontal audio=inline post-menu=enabled`);
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();
  const block=/  \/\* Assurance Regent v6\.3\.55 — compact composer, inline audio playback and post menus START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.55 — compact composer, inline audio playback and post menus END \*\//u;
  if(block.test(s))s=s.replace(block,addon);
  else{
    const anchor='  function renderExtendedProfileFields()';
    if(!s.includes(anchor))throw new Error(`Department Hub feed-control runtime anchor missing in ${basename(file)}.`);
    s=s.replace(anchor,addon+'\n'+anchor);
  }
  if(s.includes('renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();}')&&!s.includes('renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}'))s=s.replace('renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();}','renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}');
  const bind=/  function bindAiCompanyHubUi\(\)\{[^\n]*\}/u;
  if(bind.test(s)){
    let current=s.match(bind)?.[0]||'';
    if(!current.includes('bindCompanyHubFeedControlsUi55()'))current=current.slice(0,-1)+'bindCompanyHubFeedControlsUi55();}';
    s=s.replace(bind,current);
  }
  for(const token of ['companyHubAudioMarkup55','companyHubHydrateInlineAudio55','companyHubDecorateInlineAudio55','data-company-audio-toggle','data-company-audio-seek','companyHubPostMenuMarkup55','data-company-post-menu-toggle','data-company-post-delete','assurance_regent_browser_department_social_delete','companyHubDeletePost55','renderCompanyHubFeedControls55','bindCompanyHubFeedControlsUi55'])if(!s.includes(token))throw new Error(`Department Hub feed-control runtime missing ${token} in ${basename(file)}.`);
  if(!s.includes('renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}'))throw new Error(`Department Hub feed-control render hook missing in ${basename(file)}.`);
  if(!s.includes('bindCompanyHubFeedControlsUi55();'))throw new Error(`Department Hub feed-control binder missing in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-feed-controls] ${basename(file)} inline-audio=enabled owner-delete=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
