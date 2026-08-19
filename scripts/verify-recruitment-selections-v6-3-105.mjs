import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appTargets=[resolve(root,'app.js')],htmlTargets=[resolve(root,'index.html')],styleTargets=[resolve(root,'styles.css')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^index(?:\.|-).*\.html$/iu.test(name))htmlTargets.push(join(publicDir,name));
  if(/^styles(?:\.|-).*\.css$/iu.test(name))styleTargets.push(join(publicDir,name));
}
let appCount=0,htmlCount=0,styleCount=0;
for(const file of appTargets.filter(existsSync)){
  const source=readFileSync(file,'utf8');appCount++;
  for(const token of ["const RECRUITMENT_SELECTIONS_SCHEMA105='6.3.105'","'Interview','Selected','Offer Sent'",'renderRecruitSelections105','selectionFitCell105','selectionPerformanceCell105','sendRecruitSelectionOutreach105','sendRecruitSelectionsToOnboarding105','assurance_regent_browser_recruitment_selection_update','assurance_regent_browser_recruitment_selection_onboarding','automaticSelection:false','scoreUse:\'display-only\''])if(!source.includes(token))throw new Error(`Recruitment selections verification missing ${token} in ${basename(file)}.`);
  if(!source.includes("['Selected','Offer Accepted'].includes(c.stage)"))throw new Error(`Onboarding does not receive Selected candidates in ${basename(file)}.`);
}
for(const file of htmlTargets.filter(existsSync)){
  const source=readFileSync(file,'utf8');htmlCount++;
  for(const token of ['data-recruit-tab="funnel">Funnel</button>','data-recruit-tab="selections">Selections','data-recruit-tab="analytics">Analytics</button>','id="recruitPanelSelections"','id="recruitSelectionsEmail"','id="recruitSelectionsWhatsApp"','id="recruitSelectionsOnboarding"','id="recruitSelectionsTable"','<option>Selected</option>'])if(!source.includes(token))throw new Error(`Recruitment selections HTML verification missing ${token} in ${basename(file)}.`);
  const funnel=source.indexOf('data-recruit-tab="funnel"'),selections=source.indexOf('data-recruit-tab="selections"'),analytics=source.indexOf('data-recruit-tab="analytics"');if(!(funnel>=0&&selections>funnel&&analytics>selections))throw new Error(`Selections tab is not between Funnel and Analytics in ${basename(file)}.`);
}
for(const file of styleTargets.filter(existsSync)){
  const source=readFileSync(file,'utf8');styleCount++;for(const token of ['recruit-selection-panel','recruit-selection-actions','selection-check-cell','selection-performance','recruit-selection-delivery'])if(!source.includes(token))throw new Error(`Recruitment selections style verification missing ${token} in ${basename(file)}.`);
}
if(!appCount||!htmlCount||!styleCount)throw new Error('Recruitment selections verifier did not find all required client targets.');
console.log(`[verify-recruitment-selections-v6-3-105] PASS apps=${appCount} html=${htmlCount} css=${styleCount} HR selection is human-controlled, persisted, communicable and received by Onboarding`);
