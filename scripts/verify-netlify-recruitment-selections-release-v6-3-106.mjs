import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html')],appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^index(?:\.|-).*\.html$/iu.test(name))htmlTargets.push(join(publicDir,name));
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
}
for(const file of htmlTargets.filter(existsSync)){
  const s=readFileSync(file,'utf8');
  for(const token of ['data-recruit-tab="funnel"','data-recruit-tab="selections"','data-recruit-tab="analytics"','id="recruitPanelSelections"','id="recruitSelectionsTable"'])if(!s.includes(token))throw new Error(`v6.3.106 Selections release verification missing ${token} in ${basename(file)}.`);
  if(s.indexOf('data-recruit-tab="selections"')<s.indexOf('data-recruit-tab="funnel"')||s.indexOf('data-recruit-tab="selections"')>s.indexOf('data-recruit-tab="analytics"'))throw new Error(`Selections tab is not between Funnel and Analytics in ${basename(file)}.`);
}
for(const file of appTargets.filter(existsSync)){
  const s=readFileSync(file,'utf8');
  for(const token of ['RECRUITMENT_SELECTIONS_SCHEMA105','renderRecruitSelections105','assurance_regent_browser_recruitment_selection_update','assurance_regent_browser_recruitment_selection_onboarding'])if(!s.includes(token))throw new Error(`v6.3.106 Selections runtime verification missing ${token} in ${basename(file)}.`);
}
console.log('[netlify-recruitment-selections-release-v6-3-106] protected Selections tab/runtime verified for production publish');
