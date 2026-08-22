import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd();
const publicDir=resolve(root,'public');
const netlifyFile=resolve(root,'netlify.toml');
const workflowFile=resolve(root,'.github/workflows/protected-build-check.yml');
const rootIndex=resolve(root,'index.html');

const productionCommand='npm run build && node scripts/apply-dashboard-holiday-descriptions-v6-3-116.mjs && node scripts/apply-onboarding-completion-transfer-v6-3-118.mjs && node scripts/apply-system-runtime-stability-v6-3-119.mjs';
if(!existsSync(netlifyFile))throw new Error('netlify.toml is required.');
if(!readFileSync(netlifyFile,'utf8').includes(productionCommand))throw new Error('Netlify must apply v6.3.119 as the final runtime stability patch.');
if(!existsSync(workflowFile))throw new Error('Protected build workflow is required.');
if(!readFileSync(workflowFile,'utf8').includes(productionCommand))throw new Error('GitHub protected build must run the same v6.3.119 production command as Netlify.');

const rootApp=resolve(root,'app.js');
const targets=[rootApp];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const required119=[
  'SYSTEM_RUNTIME_STABILITY_SCHEMA119','6.3.119','criticalStateWriteFetch119',
  'RAW_FETCH(url','snapshot retained for retry','standaloneSaveGeneration119',
  'standaloneSaveLastError119','standaloneSaveRetryGeneration119','flushStandaloneSaveDurable119',
  'retryRetainedStandaloneSave119','standaloneSaveRecoveryTimer119','handleAccessGateError',
  'criticalStateWriteLane:true','failedSnapshotsRetained:true','boundedRetry:true',
  'maintenanceRetry:true','retryBudgetResetsPerGeneration:true','accessGateAware:true',
  'authoritativeServerStateAdoption:true','onboardingActiveStateInvariant:true',
  'AssuranceRegentRuntimeStability'
];
const required118=[
  'ONBOARDING_COMPLETION_TRANSFER_SCHEMA118','onboardingActiveRows118',
  'installOnboardingCompletionCapture118','switchView(\'employees\')',
  'activeQueueOnly:true','completedRecordsRetainedForAudit:true',
  'successAcceptsArchivedRemoval:true'
];
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of required118)if(!source.includes(token))throw new Error(`v6.3.118 onboarding invariant missing ${token} in ${basename(file)}.`);
  for(const token of required119)if(!source.includes(token))throw new Error(`v6.3.119 runtime stability missing ${token} in ${basename(file)}.`);
  if(source.indexOf('Assurance Regent v6.3.119 — durable runtime state persistence START')<source.indexOf('Assurance Regent v6.3.118 — onboarding completion transfer END'))throw new Error(`v6.3.119 must execute after v6.3.118 in ${basename(file)}.`);
}

if(!existsSync(rootIndex))throw new Error('Root index.html is required for direct-static hosting.');
const rootHtml=readFileSync(rootIndex,'utf8');
if(!rootHtml.includes('./app.js?v=6.3.119'))throw new Error('Root static index is not cache-busted to app.js v6.3.119.');
if(rootHtml.includes('./app.js?v=6.3.19'))throw new Error('Root static index still references stale app.js v6.3.19.');

function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
let sriBindings=0;
if(existsSync(publicDir)){
  const htmlFiles=walk(publicDir).filter(file=>file.endsWith('.html'));
  for(const appFile of targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile())){
    const name=basename(appFile),sri=sriFor(appFile),version=versionFor(appFile);
    for(const htmlFile of htmlFiles){
      const html=readFileSync(htmlFile,'utf8');
      if(!html.includes(`./${name}`))continue;
      if(!html.includes(`src="./${name}?v=${version}"`)||!html.includes(`integrity="${sri}"`))throw new Error(`Final SRI/version for ${name} is stale in ${basename(htmlFile)}.`);
      sriBindings+=1;
    }
  }
}
if(targets.some(file=>file!==rootApp&&existsSync(file))&&sriBindings<1)throw new Error('No final public app-script SRI binding was verified.');

const migration=resolve(root,'ASSURANCE_REGENT_ONBOARDING_STATE_INVARIANT_V6_3_119.sql');
if(!existsSync(migration))throw new Error('v6.3.119 onboarding database invariant migration is missing.');
const sql=readFileSync(migration,'utf8');
for(const token of [
  'assurance_regent_onboarding_history','assurance_regent_browser_write_state',
  'assurance_regent_browser_read_state','live,onboarding',"='complete'",
  "<> 'complete'",'enable row level security','revoke all on table public.assurance_regent_onboarding_history'
])if(!sql.includes(token))throw new Error(`v6.3.119 database invariant is missing ${token}.`);

console.log(`[verify-system-runtime-stability-v6-3-119] OK apps=${targets.filter(existsSync).length} durable-state=1 failed-snapshot-retention=1 critical-write-lane=1 maintenance-retry=1 onboarding-read-write-invariant=1 archive-rls=1 direct-static-cache-bust=1 sri-bindings=${sriBindings}`);
