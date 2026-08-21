import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/recruitment-selections-visible-override-v6-3-107-app-runtime.inc.js');
const stylesFile=resolve(root,'scripts/recruitment-selections-visible-override-v6-3-107-styles.inc.css');
if(!existsSync(runtimeFile)||!existsSync(stylesFile))throw new Error('Recruitment Selections visibility override v6.3.107 assets are missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),styles=readFileSync(stylesFile,'utf8').trimEnd();
const runtimeBlock=/  \/\* Assurance Regent v6\.3\.107 — force visible Recruiting Selections tab START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.107 — force visible Recruiting Selections tab END \*\//u;
const styleBlock=/\/\* Assurance Regent v6\.3\.107 — force visible Recruiting Selections tab START \*\/[\s\S]*?\/\* Assurance Regent v6\.3\.107 — force visible Recruiting Selections tab END \*\//u;
const appTargets=[resolve(root,'app.js')],htmlTargets=[resolve(root,'index.html')],styleTargets=[resolve(root,'styles.css')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^index(?:\.|-).*\.html$/iu.test(name))htmlTargets.push(join(publicDir,name));
  if(/^styles(?:\.|-).*\.css$/iu.test(name))styleTargets.push(join(publicDir,name));
}

for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(runtimeBlock.test(source))source=source.replace(runtimeBlock,runtime);else{
    const anchor='  /* Assurance Regent v6.3.105 — HR recruitment selections to onboarding END */';
    if(!source.includes(anchor))throw new Error(`Selections visibility override requires v6.3.105 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECRUITMENT_SELECTIONS_VISIBLE_SCHEMA107','ensureRecruitSelectionsVisible107','forceVisible:true','placement:\'before-analytics\'','runtimeRecovery:true'])if(!source.includes(token))throw new Error(`Selections visibility runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Selections visibility syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

const selectionButton='<button type="button" data-recruit-tab="selections" data-selections-force-visible107="true">Selections <span id="recruitSelectionCount">0</span></button>';
const selectionPanel='<div class="recruit-tab-panel" id="recruitPanelSelections"><section class="panel recruit-selection-panel"><div class="panel-head"><div><span class="section-kicker">Human Resources decision</span><h3>Selections</h3><p>Review applicant performance and advisory scores, tick the candidates HR selects, then communicate or transfer them to Onboarding. Scores never select a candidate automatically.</p></div><div class="recruit-selection-actions"><button class="btn small secondary" id="recruitSelectionsEmail" type="button">✉ Send email</button><button class="btn small secondary" id="recruitSelectionsWhatsApp" type="button">◉ Send WhatsApp</button><button class="btn small primary" id="recruitSelectionsOnboarding" type="button">↗ Send to Onboarding</button></div></div><div class="recruit-selection-summary"><span id="recruitSelectionSummary">0 selected · HR makes the final selection decision</span><b>Job-related evidence only</b></div><div class="recruit-selection-delivery" id="recruitSelectionDelivery" hidden></div><div class="table-wrap tall"><table id="recruitSelectionsTable"></table></div></section></div>';
for(const file of htmlTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  const selectionButtonRe=/<button\b[^>]*data-recruit-tab=["']selections["'][^>]*>[\s\S]*?<\/button>/iu;
  if(selectionButtonRe.test(source))source=source.replace(selectionButtonRe,selectionButton);else{
    const analyticsButton=/<button\b[^>]*data-recruit-tab=["']analytics["'][^>]*>[\s\S]*?<\/button>/iu;
    const match=source.match(analyticsButton);if(!match)throw new Error(`Analytics tab anchor missing in ${basename(file)}.`);source=source.replace(analyticsButton,`${selectionButton}\n              ${match[0]}`);
  }
  if(!source.includes('id="recruitPanelSelections"')){
    const analyticsPanel='<div class="recruit-tab-panel" id="recruitPanelAnalytics">';
    const i=source.indexOf(analyticsPanel);if(i<0)throw new Error(`Analytics panel anchor missing in ${basename(file)}.`);source=source.slice(0,i)+selectionPanel+'\n            '+source.slice(i);
  }
  const funnelPos=source.indexOf('data-recruit-tab="funnel"'),selectionPos=source.indexOf('data-recruit-tab="selections"'),analyticsPos=source.indexOf('data-recruit-tab="analytics"');
  if(!(funnelPos>=0&&selectionPos>funnelPos&&analyticsPos>selectionPos))throw new Error(`Selections tab order is invalid in ${basename(file)}.`);
  for(const token of ['data-selections-force-visible107="true"','>Selections <span id="recruitSelectionCount">','id="recruitPanelSelections"','id="recruitSelectionsTable"'])if(!source.includes(token))throw new Error(`Selections visibility HTML missing ${token} in ${basename(file)}.`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

for(const file of styleTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(styleBlock.test(source))source=source.replace(styleBlock,styles);else source=`${source.trimEnd()}\n\n${styles}\n`;
  if(!source.includes('#recruitTabs [data-recruit-tab="selections"]')||!source.includes('display:inline-flex!important'))throw new Error(`Selections visibility CSS missing in ${basename(file)}.`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

console.log('[recruitment-selections-visible-v6-3-107] static-tab=forced runtime-recovery=forced placement=before-analytics visibility=important');
await import('./verify-recruitment-selections-visible-v6-3-107.mjs');
await import('./apply-company-country-holidays-v6-3-109.mjs');
