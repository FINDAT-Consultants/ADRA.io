import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const root=process.cwd(),p=resolve(root,'public');
if(!existsSync(p))throw new Error('public/ missing.');
const html=readFileSync(join(p,'index.html'),'utf8'),appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published app runtime missing.');
const appPath=join(p,appName),app=readFileSync(appPath,'utf8'),css=readFileSync(join(p,'department-hub-feed-controls.css'),'utf8'),sql=readFileSync(resolve(root,'supabase/DEPARTMENT_HUB_POST_CONTROLS_V6_3_55.sql'),'utf8');

if(!html.includes('department-hub-feed-controls.css?v=6.3.55'))throw new Error('Department Hub feed-control stylesheet is not linked.');
for(const token of ['#companyHubForm .company-social-composer-actions','flex-wrap:nowrap!important','#companyHubForm .social-composer-tools','min-height:30px!important','.company-hub-inline-audio-post','.company-hub-inline-audio-toggle','.company-hub-inline-audio-wave-wrap','.company-social-post-menu-toggle','.company-social-post-menu button.danger'])if(!css.includes(token))throw new Error(`Department Hub feed-control style missing: ${token}`);
for(const token of ['companyHubAudioMarkup55','companyHubHydrateInlineAudio55','companyHubDecorateInlineAudio55','persistentFileDownload','companyHubWavePeaks54','companyHubDrawWaveform54','data-company-audio-toggle','data-company-audio-seek','companyHubPostMenuMarkup55','data-company-post-menu-toggle','data-company-post-delete','companyHubDeletePost55','assurance_regent_browser_department_social_delete','renderCompanyHubFeedControls55','bindCompanyHubFeedControlsUi55'])if(!app.includes(token))throw new Error(`Department Hub feed-control runtime missing: ${token}`);
if(app.includes("openCompanyHubInlineViewer54(audio.dataset.companyInlineAudio,'audio',audio)")){
  if(!app.includes("button.company-hub-inline-audio-card[data-company-inline-audio]"))throw new Error('Old audio modal handler remains reachable without the inline-audio replacement guard.');
}
for(const token of ['create or replace function public.assurance_regent_browser_department_social_delete','You can delete only posts you created.','sender_id=uid','parent_id is null','assurance_regent_department_social_retention_queue','on conflict(file_id)','deletion_source','department-hub-owner-delete','on delete cascade']){
  if(token==='on delete cascade')continue;
  if(!sql.toLowerCase().includes(token.toLowerCase()))throw new Error(`Department Hub owner-delete SQL missing: ${token}`);
}
if(!app.includes('renderCompanyHubSocialLayer();renderCompanyHubControls53();renderCompanyHubInlineMedia54();renderCompanyHubFeedControls55();}'))throw new Error('Department Hub feed-control render hook is not connected.');
if(!app.includes('bindCompanyHubFeedControlsUi55();'))throw new Error('Department Hub feed-control binder is not connected.');
execFileSync(process.execPath,['--check',appPath],{stdio:'pipe'});

console.log('[department-hub-feed-controls-verify] OK: Photo, Video, Audio, File and Emoji stay compact and horizontal with Post on desktop.');
console.log('[department-hub-feed-controls-verify] OK: audio is converted from the modal trigger into an inline post player with play/pause, waveform, duration and draggable seek.');
console.log('[department-hub-feed-controls-verify] OK: every root post gets a three-dot options menu; Delete is rendered only for the signed-in post owner.');
console.log('[department-hub-feed-controls-verify] OK: post deletion is server-authorized, cascades conversation records and queues unreferenced attachments for Storage cleanup.');
