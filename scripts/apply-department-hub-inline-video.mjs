import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const css=resolve(root,'department-hub-inline-video.css'),runtime=resolve(root,'scripts/department-hub-inline-video-runtime.inc.js'),statusCss=resolve(root,'department-hub-status-upload.css'),statusRuntime=resolve(root,'scripts/department-hub-status-upload-runtime.inc.js');
if(!existsSync(css)||!existsSync(runtime)||!existsSync(statusCss)||!existsSync(statusRuntime))throw new Error('Department Hub inline-video/status-upload assets are missing.');
if(existsSync(publicDir)){writeFileSync(join(publicDir,'department-hub-inline-video.css'),readFileSync(css,'utf8'),'utf8');writeFileSync(join(publicDir,'department-hub-status-upload.css'),readFileSync(statusCss,'utf8'),'utf8');}

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  s=s.replace(/\s*<link rel="stylesheet" href="\.\/department-hub-inline-video\.css\?v=[^"]+" \/>/gu,'').replace(/\s*<link rel="stylesheet" href="\.\/department-hub-status-upload\.css\?v=[^"]+" \/>/gu,'');
  const link='  <link rel="stylesheet" href="./department-hub-inline-video.css?v=6.3.59" />\n  <link rel="stylesheet" href="./department-hub-status-upload.css?v=6.3.61" />';
  const anchor='<link rel="stylesheet" href="./department-hub-composer-fit.css?v=6.3.58" />';
  if(s.includes(anchor))s=s.replace(anchor,anchor+'\n'+link);
  else if(s.includes('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />'))s=s.replace('<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />','<link rel="stylesheet" href="./department-hub-inline-media.css?v=6.3.54" />\n'+link);
  else s=s.replace('</head>',link+'\n</head>');
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-inline-video] ${basename(file)} inline-only=enabled viewport-autoplay=enabled status-media=contain upload-progress=enabled`);
}

function patchUploadTransport(s,file){
  const helper=`  /* Assurance Regent v6.3.61 — byte-accurate private Storage upload progress START */\n  function dispatchPersistentUploadProgress61(detail={}){try{window.dispatchEvent(new CustomEvent('assurance-regent-upload-progress',{detail}));}catch{}}\n  function uploadPersistentBlobWithProgress61(url,body,meta={}){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest(),name=String(meta.name||'File'),category=String(meta.category||'general');let last=0;const emit=(phase,percent)=>{const pct=Math.max(0,Math.min(100,Math.round(Number(percent||0))));if(phase==='uploading'&&pct<last)return;last=Math.max(last,pct);dispatchPersistentUploadProgress61({phase,percent:pct,name,category,loaded:Number(meta.loaded||0),total:Number(meta.size||0)});};try{xhr.open('PUT',url,true);xhr.timeout=180000;xhr.responseType='text';xhr.setRequestHeader('apikey',SUPABASE_PUBLISHABLE_KEY);xhr.setRequestHeader('x-upsert','false');xhr.upload.addEventListener('progress',event=>{if(event.lengthComputable&&event.total>0)emit('uploading',(event.loaded/event.total)*100);});xhr.addEventListener('load',()=>{const ok=xhr.status>=200&&xhr.status<300;emit(ok?'upload-complete':'error',ok?100:last);resolve({ok,status:xhr.status,text:async()=>String(xhr.responseText||'')});});xhr.addEventListener('error',()=>{emit('error',last);reject(new Error('Network error while uploading file.'));});xhr.addEventListener('timeout',()=>{emit('error',last);reject(new Error('File upload timed out.'));});xhr.addEventListener('abort',()=>{emit('error',last);reject(new Error('File upload was cancelled.'));});emit('uploading',0);xhr.send(body);}catch(err){emit('error',last);reject(err);}});}\n  /* Assurance Regent v6.3.61 — byte-accurate private Storage upload progress END */\n`;
  const helperBlock=/  \/\* Assurance Regent v6\.3\.61 — byte-accurate private Storage upload progress START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.61 — byte-accurate private Storage upload progress END \*\/\n?/u;
  if(helperBlock.test(s))s=s.replace(helperBlock,helper);else{const anchor='  async function uploadPersistentBlob(blob,name,options={}){';if(!s.includes(anchor))throw new Error(`Persistent upload anchor missing in ${basename(file)}.`);s=s.replace(anchor,helper+anchor);}
  const oldUpload="let r;try{r=await managedFetch(prep.signed_url,{method:'PUT',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'x-upsert':'false'},body:form},{timeout:180000,retries:0});}catch(err){throw new Error(`Supabase file upload failed: ${err?.message||err}`);}";
  const newUpload="let r;try{r=await uploadPersistentBlobWithProgress61(prep.signed_url,form,{name:fileName,size,category:options.category||'general'});}catch(err){throw new Error(`Supabase file upload failed: ${err?.message||err}`);}";
  if(s.includes(oldUpload))s=s.replace(oldUpload,newUpload);else if(!s.includes(newUpload))throw new Error(`Persistent upload transport was not found in ${basename(file)}.`);
  const oldCommit="const committed=await supabaseFunction('assurance-regent-files',{mode:'commit_upload',file_id:prep.file_id});";
  const newCommit="let committed;try{committed=await supabaseFunction('assurance-regent-files',{mode:'commit_upload',file_id:prep.file_id});}catch(err){dispatchPersistentUploadProgress61({phase:'error',percent:100,name:fileName,category:options.category||'general'});throw err;}dispatchPersistentUploadProgress61({phase:'done',percent:100,name:fileName,category:options.category||'general'});";
  if(s.includes(oldCommit))s=s.replace(oldCommit,newCommit);else if(!s.includes(newCommit))throw new Error(`Persistent upload commit anchor was not found in ${basename(file)}.`);
  return s;
}

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd(),statusAddon=readFileSync(statusRuntime,'utf8').trimEnd();
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

  const statusBlock=/  \/\* Assurance Regent v6\.3\.61 — Department Hub upload progress UI START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.61 — Department Hub upload progress UI END \*\//u;
  if(statusBlock.test(s))s=s.replace(statusBlock,statusAddon);else{const runtimeAnchor='  function renderExtendedProfileFields()';if(!s.includes(runtimeAnchor))throw new Error(`Status/upload runtime anchor missing in ${basename(file)}.`);s=s.replace(runtimeAnchor,statusAddon+'\n'+runtimeAnchor);}
  s=patchUploadTransport(s,file);

  const renderOld='renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}';
  const renderNew='renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();renderCompanyHubInlineVideo59();}';
  if(s.includes(renderOld))s=s.replace(renderOld,renderNew);
  else if(!s.includes(renderNew))throw new Error(`Department Hub render hook missing in ${basename(file)}.`);

  const bind=/  function bindAiCompanyHubUi\(\)\{[^\n]*\}/u;
  if(!bind.test(s))throw new Error(`Department Hub binder missing in ${basename(file)}.`);
  let current=s.match(bind)?.[0]||'';
  if(!current.includes('bindCompanyHubInlineVideo59()'))current=current.slice(0,-1)+'bindCompanyHubInlineVideo59();}';
  s=s.replace(bind,current);

  for(const token of ['companyHubInlineVideos59','companyHubPrepareInlineVideo59','companyHubAutoplayBestVisibleVideo59','IntersectionObserver','intersectionRatio','companyHubPauseOtherInlineVideos59','renderCompanyHubInlineVideo59','bindCompanyHubInlineVideo59','uploadPersistentBlobWithProgress61','XMLHttpRequest','assurance-regent-upload-progress','companyHubHandleUploadProgress61'])if(!s.includes(token))throw new Error(`Department Hub inline-video/status-upload runtime missing ${token} in ${basename(file)}.`);
  if(s.includes('Open video player')||s.includes("openCompanyHubInlineViewer54(video.dataset.companyInlineVideo,'video',video)"))throw new Error(`Secondary Department Hub video player remains reachable in ${basename(file)}.`);
  if(!s.includes(renderNew)||!s.includes('bindCompanyHubInlineVideo59();'))throw new Error(`Department Hub inline-video hooks are not connected in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-inline-video] ${basename(file)} one-inline-video=enabled muted-viewport-autoplay=enabled status-media=contain real-upload-progress=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
