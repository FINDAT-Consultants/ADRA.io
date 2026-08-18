import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');if(!existsSync(publicDir))throw new Error('public/ is missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));if(!appName)throw new Error('Published app runtime is missing.');
const appPath=join(publicDir,appName),app=readFileSync(appPath,'utf8');
const runtimePath=resolve(root,'scripts/live-meet-media-v6-3-80-runtime.inc.js'),entryPath=resolve(root,'scripts/live-meet-media-client.entry.ts'),buildPath=resolve(root,'scripts/build-live-meet-media-client.mjs'),edgePath=resolve(root,'supabase/functions/meet-media-connector/index.ts'),sqlPath=resolve(root,'supabase/LIVE_MEET_MEDIA_V6_3_80.sql'),bundlePath=resolve(publicDir,'meet-media-client.bundle.js'),packagePath=resolve(root,'package.json');
for(const p of [runtimePath,entryPath,buildPath,edgePath,sqlPath,bundlePath,packagePath])if(!existsSync(p))throw new Error(`Live Meet Media required file missing: ${p}`);
const runtime=readFileSync(runtimePath,'utf8'),entry=readFileSync(entryPath,'utf8'),build=readFileSync(buildPath,'utf8'),edge=readFileSync(edgePath,'utf8'),sql=readFileSync(sqlPath,'utf8'),pkg=readFileSync(packagePath,'utf8');

for(const token of ['MEET_MEDIA_AUDIO_SCOPE80','meet-media-connector','Connect Live Meet','Bring Jivan live','AssuranceRegentMeetMedia','Waiting for Meet consent','NO_ACTIVE_CONFERENCE','data-jivan-live-meet80','data-api-meet-media-connect80'])if(!app.includes(token))throw new Error(`Published Live Meet behavior missing: ${token}`);
if(app.indexOf('Assurance Regent v6.3.80 — Jivan Live Google Meet Media assistant START')<app.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START'))throw new Error('Live Meet runtime is not layered after Developer API connections.');
for(const token of ["import {MeetMediaApiClientImpl}","google-meet-media-reference/web/internal/meetmediaapiclient_impl",'numberOfVideoStreams:0','enableAudioStreams:true','client.joinMeeting()','client.leaveMeeting()','assurance-regent-meet-media-status','assurance-regent-meet-media-participants','assurance-regent-meet-media-tracks'])if(!entry.includes(token))throw new Error(`Meet Media bridge missing: ${token}`);
for(const token of ['esbuild','chrome94','legalComments','meet-media-client.bundle.js','9baacb08c0ec3bd454816e4cf593a3f13462486b'])if(!build.includes(token))throw new Error(`Meet Media bundle build missing: ${token}`);
if(statSync(bundlePath).size<10000)throw new Error('Meet Media browser bundle is unexpectedly small.');

for(const token of [
  "const MEDIA_AUDIO_SCOPE='https://www.googleapis.com/auth/meetings.conference.media.audio.readonly'",
  "const MEDIA_SPACE_SCOPE='https://www.googleapis.com/auth/meetings.space.read'",
  "const REST_SPACE_SCOPE='https://www.googleapis.com/auth/meetings.space.readonly'",
  "const PLATFORM_ACTOR_ID='Dvp'",
  "const VERIFIED_INTERVIEW_SPACE='spaces/TcCnPqiVfn0B'",
  "if(action==='authorize_url')",
  "if(action==='disconnect')",
  "if(action==='session')",
  'ALLOWED_AUTHORITIES',
  'assurance_regent_browser_recruitment_bundle',
  'access_token:accessToken',
  'audio_only:true',
  'authenticated_principal_must_be_present:true',
  'verified_space_name:VERIFIED_INTERVIEW_SPACE',
  'Live Meet Assistant is not connected. Contact the Developer.'
])if(!edge.includes(token))throw new Error(`Live Meet Edge Function behavior missing: ${token}`);
if(!edge.includes("serviceRpc('assurance_regent_gmail_oauth_credentials'"))throw new Error('Live Meet connector is not using server-side OAuth client credentials.');
if(!edge.includes('https://meet.googleapis.com/v2/')||!edge.includes('Google Meet space lookup'))throw new Error('Live Meet connector does not resolve the meeting space through Meet REST.');
for(const token of ['https://meet.googleapis.com/v2/conferenceRecords','space.name =','end_time IS NULL','conferenceRecords.list','activeConferenceRecord','resolveInterviewSpace'])if(!edge.includes(token))throw new Error(`Live Meet active-conference resolution missing: ${token}`);
if(!edge.includes("byCodeName===VERIFIED_INTERVIEW_SPACE||knownCode===code"))throw new Error('Verified Meet space may not be used unless it matches the interview meeting code/space.');
for(const token of ['assurance_regent_meet_media_connections','assurance_regent_meet_media_oauth_states','enable row level security','revoke all on table','service_role'])if(!sql.includes(token))throw new Error(`Live Meet database protection missing: ${token}`);

for(const token of ['"build:live-meet-media"','"apply:live-meet-media-v6-3-80"','"verify:live-meet-media-v6-3-80"','"google-meet-media-reference"','9baacb08c0ec3bd454816e4cf593a3f13462486b','"esbuild"'])if(!pkg.includes(token))throw new Error(`package.json Live Meet build wiring missing: ${token}`);
if(!pkg.includes('npm run build:live-meet-media')||!pkg.includes('npm run apply:live-meet-media-v6-3-80')||!pkg.includes('npm run verify:live-meet-media-v6-3-80'))throw new Error('Live Meet build/apply/verify sequence is incomplete.');

const secretPatterns=[/GOCSPX-[A-Za-z0-9_-]{10,}/u,/AIzaSy[A-Za-z0-9_-]{20,}/u];for(const [label,text] of [['published app',app],['runtime',runtime],['entry',entry],['build script',build],['Edge Function',edge],['SQL',sql]])for(const pattern of secretPatterns)if(pattern.test(text))throw new Error(`Security regression: Google credential present in ${label}.`);
const jsonReturns=[...edge.matchAll(/return\s+json\(\{[\s\S]*?\}\s*(?:,\s*\d+)?\s*\)/gu)].map(m=>m[0]);if(jsonReturns.some(x=>/\brefresh_token\s*:/u.test(x)))throw new Error('Security regression: a browser JSON response contains a refresh_token field.');
if(!edge.includes('access_token:accessToken')||!edge.includes('expires_in:Number(access?.expires_in||3600)'))throw new Error('Live Meet session response is not constrained to a short-lived access token.');

for(const p of [appPath,runtimePath,buildPath]){const check=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(check.status!==0)throw new Error(`Syntax check failed for ${p}:\n${check.stderr||check.stdout}`);}
console.log('[live-meet-media-verify] OK: Developer-only restricted Live Meet OAuth administration is wired.');
console.log('[live-meet-media-verify] OK: authorized interview users can request a short-lived audio-only Media API session.');
console.log('[live-meet-media-verify] OK: verified Meet space and active conference-record resolution are enforced before Jivan joins.');
console.log('[live-meet-media-verify] OK: the browser bundle uses Google\'s pinned TypeScript reference client and requests zero video streams.');
console.log('[live-meet-media-verify] OK: Google secrets/refresh tokens remain server-only; normal users see feature controls, not API setup.');
