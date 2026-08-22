import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),netlifyFile=resolve(root,'netlify.toml');
if(!existsSync(netlifyFile))throw new Error('netlify.toml is required.');
const netlify=readFileSync(netlifyFile,'utf8');
if(!netlify.includes('npm run build && node scripts/apply-dashboard-holiday-descriptions-v6-3-116.mjs && node scripts/apply-onboarding-completion-transfer-v6-3-118.mjs'))throw new Error('Netlify must apply v6.3.118 after v6.3.116.');
const rootApp=resolve(root,'app.js'),targets=[rootApp];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['ONBOARDING_COMPLETION_TRANSFER_SCHEMA118','onboardingActiveRows118','String(o?.status||\'\').trim().toLowerCase()!==\'complete\'','No active onboarding records.','Completed hires are available in Employees.','await flushStandaloneSave()','state.onboardingSelected=\'\'','renderEmployees();renderCompany();','employeeCreated:Boolean(employee)','candidateHired','removedFromActiveQueue:true','persistedBeforeReload:true','completedRecordsRetainedForAudit:true'])if(!source.includes(token))throw new Error(`Onboarding completion verifier missing ${token} in ${basename(file)}.`);
  for(const token of ['engine.upsertEmployee','status:\'Hired\''])if(!source.includes(token))throw new Error(`Existing employee/candidate completion contract missing ${token} in ${basename(file)}.`);
}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
function sriFor(file){return `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;}
function versionFor(file){return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);}
let sriBindings=0;if(existsSync(publicDir)){const htmlFiles=walk(publicDir).filter(file=>file.endsWith('.html'));for(const appFile of targets.filter(file=>file!==rootApp&&existsSync(file)&&statSync(file).isFile())){const name=basename(appFile),sri=sriFor(appFile),version=versionFor(appFile);for(const htmlFile of htmlFiles){const html=readFileSync(htmlFile,'utf8');if(!html.includes(`./${name}`))continue;if(!html.includes(`src="./${name}?v=${version}"`)||!html.includes(`integrity="${sri}"`))throw new Error(`Final SRI/version for ${name} is stale in ${basename(htmlFile)}.`);sriBindings+=1;}}}
if(targets.some(file=>file!==rootApp&&existsSync(file))&&sriBindings<1)throw new Error('No final app-script SRI binding was verified.');
console.log(`[verify-onboarding-completion-transfer-v6-3-118] OK apps=${targets.filter(existsSync).length} active-queue-only=1 employee-transfer=1 candidate-hired=1 persisted-before-reload=1 sri-bindings=${sriBindings}`);
