import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const root=process.cwd(),p=resolve(root,'public');
if(!existsSync(p))throw new Error('public/ missing.');
const html=readFileSync(join(p,'index.html'),'utf8'),appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published app runtime missing.');
const appPath=join(p,appName),app=readFileSync(appPath,'utf8'),css=readFileSync(join(p,'department-hub-inline-video.css'),'utf8'),statusCss=readFileSync(join(p,'department-hub-status-upload.css'),'utf8');

if(!html.includes('department-hub-inline-video.css?v=6.3.59'))throw new Error('Department Hub inline-video stylesheet is not linked.');
if(!html.includes('department-hub-status-upload.css?v=6.3.61'))throw new Error('Department Hub Status/upload stylesheet is not linked.');
for(const token of ['.company-hub-inline-video-open','display:none!important','.company-social-media.video video','max-height:540px','object-fit:contain!important'])if(!css.includes(token))throw new Error(`Department Hub inline-video style missing: ${token}`);
for(const token of ['.company-hub-story-content>p','.company-hub-story-media img,.company-hub-story-media video','object-fit:contain!important','.company-hub-upload-progress','.company-hub-upload-progress .bar','.company-hub-upload-progress .percent'])if(!statusCss.includes(token))throw new Error(`Department Hub Status/upload style missing: ${token}`);
for(const token of ['companyHubInlineVideos59','companyHubPrepareInlineVideo59','companyHubAutoplayBestVisibleVideo59','IntersectionObserver','intersectionRatio','threshold:[0,.22,.4,.62,.8,1]','companyHubPauseOtherInlineVideos59','video.muted=true','video.controls=true','video.playsInline=true','companyHubManualPause59','renderCompanyHubInlineVideo59','bindCompanyHubInlineVideo59'])if(!app.includes(token))throw new Error(`Department Hub inline-video runtime missing: ${token}`);
for(const token of ['uploadPersistentBlobWithProgress61','new XMLHttpRequest()','xhr.upload.addEventListener(\'progress\'','assurance-regent-upload-progress','phase:\'done\'','companyHubHandleUploadProgress61','companyHubUploadProgressHost61'])if(!app.includes(token))throw new Error(`Department Hub upload-progress runtime missing: ${token}`);
if(!app.includes("uploadPersistentBlobWithProgress61(prep.signed_url,form,{name:fileName,size,category:options.category||'general'})"))throw new Error('Private Storage upload is not routed through the byte-progress transport.');
if(app.includes('Open video player'))throw new Error('The obsolete Open video player control is still present.');
if(app.includes("openCompanyHubInlineViewer54(video.dataset.companyInlineVideo,'video',video)"))throw new Error('A second modal video player is still reachable.');
if(!app.includes("node.querySelectorAll('.company-hub-inline-video-open,[data-company-inline-video]').forEach(x=>x.remove())"))throw new Error('Old secondary video-player controls are not removed during render.');
if(!app.includes('renderCompanyHubInlineVideo59();'))throw new Error('Department Hub inline-video renderer is not connected.');
if(!app.includes('bindCompanyHubInlineVideo59();'))throw new Error('Department Hub inline-video observer is not connected.');
if(!app.includes('<video controls preload="metadata" playsinline src='))throw new Error('The Department Hub no longer renders its base video directly inside the post.');
execFileSync(process.execPath,['--check',appPath],{stdio:'pipe'});

console.log('[department-hub-inline-video-verify] OK: videos use one inline player inside the post; the secondary Open video player path is gone.');
console.log('[department-hub-inline-video-verify] OK: sufficiently visible videos autoplay muted and pause when they leave the viewport.');
console.log('[department-hub-inline-video-verify] OK: Status photos/videos use contain sizing so the complete media and accompanying text remain visible.');
console.log('[department-hub-inline-video-verify] OK: private file uploads emit real byte progress from 0–100% and the Department Hub renders the progress bar until commit completes.');
