import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/recruitment-selections-v6-3-105-app-runtime.inc.js');
const stylesFile=resolve(root,'scripts/recruitment-selections-v6-3-105-styles.inc.css');
if(!existsSync(runtimeFile)||!existsSync(stylesFile))throw new Error('Recruitment selections v6.3.105 runtime/styles are missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),styles=readFileSync(stylesFile,'utf8').trimEnd();
const runtimeBlock=/  \/\* Assurance Regent v6\.3\.105 — HR recruitment selections to onboarding START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.105 — HR recruitment selections to onboarding END \*\//u;
const styleBlock=/\/\* Assurance Regent v6\.3\.105 — recruitment selections styles START \*\/[\s\S]*?\/\* Assurance Regent v6\.3\.105 — recruitment selections styles END \*\//u;
const appTargets=[resolve(root,'app.js')],htmlTargets=[resolve(root,'index.html')],styleTargets=[resolve(root,'styles.css')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^index(?:\.|-).*\.html$/iu.test(name))htmlTargets.push(join(publicDir,name));
  if(/^styles(?:\.|-).*\.css$/iu.test(name))styleTargets.push(join(publicDir,name));
}

for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  source=source.replace("const RECRUITMENT_STAGES=['Applied','Contacted','Responded','HR Call','Technical Call','Test Passed','Interview','Offer Sent','Offer Accepted'];","const RECRUITMENT_STAGES=['Applied','Contacted','Responded','HR Call','Technical Call','Test Passed','Interview','Selected','Offer Sent','Offer Accepted'];");
  source=source.replace("if(!['vacancies','candidates','funnel','analytics'].includes(tab))throw new Error('Unknown recruiting section.');","if(!['vacancies','candidates','funnel','selections','analytics'].includes(tab))throw new Error('Unknown recruiting section.');");
  if(runtimeBlock.test(source))source=source.replace(runtimeBlock,runtime);else{
    const anchor='  /* Assurance Regent v6.3.100 — uninterrupted Zari primary voice lifecycle END */';
    if(!source.includes(anchor))throw new Error(`Recruitment selections v6.3.105 requires v6.3.100 app runtime in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['RECRUITMENT_SELECTIONS_SCHEMA105','renderRecruitSelections105','assurance_regent_browser_recruitment_selection_update','assurance_regent_browser_recruitment_selection_onboarding','sendRecruitSelectionOutreach105','sendRecruitSelectionsToOnboarding105','humanDecision:true','automaticSelection:false'])if(!source.includes(token))throw new Error(`Recruitment selections runtime missing ${token} in ${basename(file)}.`);
  if(!source.includes("'Interview','Selected','Offer Sent'"))throw new Error(`Selected recruitment stage missing in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Recruitment selections syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

const selectionPanel=`            <div class="recruit-tab-panel" id="recruitPanelSelections"><section class="panel recruit-selection-panel"><div class="panel-head"><div><span class="section-kicker">Human Resources decision</span><h3>Selections</h3><p>Review applicant performance and advisory scores, tick the candidates HR selects, then communicate or transfer them to Onboarding. Scores never select a candidate automatically.</p></div><div class="recruit-selection-actions"><button class="btn small secondary" id="recruitSelectionsEmail" type="button">✉ Send email</button><button class="btn small secondary" id="recruitSelectionsWhatsApp" type="button">◉ Send WhatsApp</button><button class="btn small primary" id="recruitSelectionsOnboarding" type="button">↗ Send to Onboarding</button></div></div><div class="recruit-selection-summary"><span id="recruitSelectionSummary">0 selected · HR makes the final selection decision</span><b>Job-related evidence only</b></div><div class="recruit-selection-delivery" id="recruitSelectionDelivery" hidden></div><div class="table-wrap tall"><table id="recruitSelectionsTable"></table></div></section></div>`;
for(const file of htmlTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(!source.includes('data-recruit-tab="selections"')){
    const funnelTab='<button type="button" class="active" data-recruit-tab="funnel">Funnel</button>';
    if(!source.includes(funnelTab))throw new Error(`Recruitment Funnel tab anchor missing in ${basename(file)}.`);
    source=source.replace(funnelTab,`${funnelTab}\n              <button type="button" data-recruit-tab="selections">Selections <span id="recruitSelectionCount">0</span></button>`);
  }
  if(!source.includes('id="recruitPanelSelections"')){
    const analyticsAnchor='            <div class="recruit-tab-panel" id="recruitPanelAnalytics">';
    if(!source.includes(analyticsAnchor))throw new Error(`Recruitment Analytics panel anchor missing in ${basename(file)}.`);
    source=source.replace(analyticsAnchor,`${selectionPanel}\n${analyticsAnchor}`);
  }
  source=source.replace('<option>Interview</option><option>Offer Sent</option>','<option>Interview</option><option>Selected</option><option>Offer Sent</option>');
  source=source.replace('Offer accepted → employee master','Recruitment selection → employee master');
  for(const token of ['data-recruit-tab="selections"','id="recruitPanelSelections"','id="recruitSelectionsEmail"','id="recruitSelectionsWhatsApp"','id="recruitSelectionsOnboarding"','id="recruitSelectionsTable"','<option>Selected</option>'])if(!source.includes(token))throw new Error(`Recruitment selections HTML missing ${token} in ${basename(file)}.`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

for(const file of styleTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(styleBlock.test(source))source=source.replace(styleBlock,styles);else source=`${source.trimEnd()}\n\n${styles}\n`;
  if(!source.includes('.recruit-selection-panel')||!source.includes('.selection-performance'))throw new Error(`Recruitment selections styles missing in ${basename(file)}.`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

if(!appTargets.some(existsSync)||!htmlTargets.some(existsSync)||!styleTargets.some(existsSync))throw new Error('Recruitment selections v6.3.105 could not find all protected client targets.');
console.log('[recruitment-selections-v6-3-105] tab=between-funnel-analytics scores=display-only HR-checkbox=persisted email+whatsapp=enabled onboarding=connected');
await import('./verify-recruitment-selections-v6-3-105.mjs');
