import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html')],styleTargets=[resolve(root,'styles.css')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^index(?:\.|-).*\.html$/iu.test(name))htmlTargets.push(join(publicDir,name));
  if(/^styles(?:\.|-).*\.css$/iu.test(name))styleTargets.push(join(publicDir,name));
}
let htmlSeen=0,styleSeen=0;
for(const file of htmlTargets.filter(existsSync)){
  const source=readFileSync(file,'utf8');htmlSeen++;
  const f=source.indexOf('data-recruit-tab="funnel"'),s=source.indexOf('data-recruit-tab="selections"'),a=source.indexOf('data-recruit-tab="analytics"');
  if(!(f>=0&&s>f&&a>s))throw new Error(`Final Recruiting tab order is not Funnel → Selections → Analytics in ${basename(file)}.`);
  for(const token of ['data-selections-force-visible107="true"','Selections <span id="recruitSelectionCount">','id="recruitPanelSelections"','id="recruitSelectionsTable"'])if(!source.includes(token))throw new Error(`Final Selections HTML missing ${token} in ${basename(file)}.`);
}
const rootApp=resolve(root,'app.js');if(!existsSync(rootApp))throw new Error('Root app.js is missing for Selections runtime verification.');
const appSource=readFileSync(rootApp,'utf8');
for(const token of ['RECRUITMENT_SELECTIONS_VISIBLE_SCHEMA107','ensureRecruitSelectionsVisible107','forceVisible:true','runtimeRecovery:true','RECRUITMENT_SELECTIONS_SCHEMA105','renderRecruitSelections105'])if(!appSource.includes(token))throw new Error(`Root Selections runtime missing ${token}.`);
for(const file of styleTargets.filter(existsSync)){
  const source=readFileSync(file,'utf8');styleSeen++;
  for(const token of ['#recruitTabs [data-recruit-tab="selections"]','display:inline-flex!important','visibility:visible!important'])if(!source.includes(token))throw new Error(`Final Selections visibility CSS missing ${token} in ${basename(file)}.`);
}
if(!htmlSeen||!styleSeen)throw new Error('Final Selections visibility verifier could not find final HTML/CSS targets.');
console.log(`[verify-recruitment-selections-visible-v6-3-107] html=${htmlSeen} styles=${styleSeen} tab=visible order=funnel>selections>analytics runtime-recovery=root-confirmed`);
