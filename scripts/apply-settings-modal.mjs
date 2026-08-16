import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd();
const publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

const cssLink='  <link rel="stylesheet" href="./settings-modal.css?v=6.3.30" />\n';
const nav=`      <aside class="settings-modal-nav" aria-label="Settings categories">
        <button type="button" class="settings-modal-close" id="settingsModalClose" aria-label="Close settings">×</button>
        <label class="settings-modal-search"><span>⌕</span><input id="settingsSearch" type="search" autocomplete="off" placeholder="Search settings" /></label>
        <nav class="settings-modal-menu" id="settingsModalMenu">
          <button type="button" class="active" data-settings-nav="general"><span>⚙</span>General</button>
          <button type="button" data-settings-nav="appearance"><span>◐</span>Appearance</button>
          <button type="button" data-settings-nav="costing"><span>¤</span>Costing</button>
          <button type="button" data-settings-nav="access"><span>♙</span>Access &amp; Roles</button>
          <button type="button" data-settings-nav="intelligence"><span>✦</span>AI &amp; Intelligence</button>
        </nav>
      </aside>
      <section class="settings-modal-main">
        <header class="settings-modal-main-head"><h2 id="settingsPageTitle">General</h2><p id="settingsPageSubtitle">Core company display and operational preferences.</p></header>
`;
const appearance=`        <section class="control-settings-section" id="settingsAppearanceSection" data-settings-page="appearance" hidden>
          <div class="settings-section-head"><div><b>Appearance</b><small>Choose how Assurance Regent looks on this device. Your selection is remembered.</small></div></div>
          <div class="settings-appearance-row">
            <div class="settings-appearance-copy"><b>Theme</b><small>Switch the full application between light and dark appearance.</small></div>
            <div class="theme-toggle" role="group" aria-label="Appearance theme"><button type="button" data-theme-choice="light">Light</button><button type="button" data-theme-choice="dark">Dark</button></div>
          </div>
          <div class="settings-appearance-row">
            <div class="settings-appearance-copy"><b>Preview</b><small>The sidebar keeps the Assurance Regent brand treatment in both modes.</small></div>
            <div class="theme-preview" aria-hidden="true"><i></i><span></span></div>
          </div>
        </section>
`;

function patchHtml(file){
  let source=readFileSync(file,'utf8'),original=source;
  if(!source.includes('settings-modal.css?v=6.3.30'))source=source.replace('</head>',`${cssLink}</head>`);
  if(!source.includes('class="settings-modal-nav"')){
    const open='<div class="control-pane" id="controlPaneSettings" data-control-pane="settings" hidden>\n      <form id="controlSettingsForm" class="control-settings-form">';
    if(!source.includes(open))throw new Error(`Settings pane opening anchor missing in ${basename(file)}.`);
    source=source.replace(open,`<div class="control-pane settings-modal-pane" id="controlPaneSettings" data-control-pane="settings" hidden>\n${nav}      <form id="controlSettingsForm" class="control-settings-form">\n${appearance}`);
    const close='        <div class="control-form-actions"><button type="submit" class="btn primary">Save settings</button></div>\n      </form>\n    </div>\n    <div class="control-pane" id="controlPaneProfile"';
    if(!source.includes(close))throw new Error(`Settings pane closing anchor missing in ${basename(file)}.`);
    source=source.replace(close,'        <div class="control-form-actions"><button type="submit" class="btn primary">Save settings</button></div>\n      </form>\n      </section>\n    </div>\n    <div class="control-pane" id="controlPaneProfile"');
  }
  source=source.replace('<section class="control-settings-section"><div class="settings-section-head"><div><b>Currency & country</b>','<section class="control-settings-section" id="settingsGeneralSection" data-settings-page="general"><div class="settings-section-head"><div><b>Currency & country</b>');
  source=source.replace('<section class="control-settings-section"><div class="settings-section-head"><div><b>Hourly currency rates</b>','<section class="control-settings-section" id="settingsCostingSection" data-settings-page="costing" hidden><div class="settings-section-head"><div><b>Hourly currency rates</b>');
  source=source.replace('<section class="control-settings-section" id="accessManagementSection">','<section class="control-settings-section" id="accessManagementSection" data-settings-page="access" hidden>');
  source=source.replace('<section class="control-settings-section intelligence-settings" hidden>','<section class="control-settings-section intelligence-settings" id="settingsIntelligenceSection" data-settings-page="intelligence" hidden>');
  if(source!==original)writeFileSync(file,source,'utf8');
  console.log(`[settings-modal] ${basename(file)} compact-modal=enabled categories=enabled appearance=enabled`);
}

const helper=`
  /* Assurance Regent v6.3.30 — compact Settings modal + persistent theme. */
  const APP_THEME_KEY='assurance-regent-appearance-v1';
  let settingsActivePage='general';
  const SETTINGS_PAGE_META={
    general:['General','Core company display and operational preferences.'],
    appearance:['Appearance','Choose the visual appearance used across Assurance Regent.'],
    costing:['Costing','Operational currency and hourly costing configuration.'],
    access:['Access & Roles','Company authority, approvals and service controls.'],
    intelligence:['AI & Intelligence','Advisory intelligence, reasoning and adaptive learning status.']
  };
  function normalizeAppTheme(value){return String(value||'').toLowerCase()==='dark'?'dark':'light';}
  function applyAppTheme(value,persist=true){
    const theme=normalizeAppTheme(value);document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;
    if(persist)localSet(APP_THEME_KEY,theme);
    document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===theme));
    window.dispatchEvent(new CustomEvent('assurance-regent-theme-change',{detail:{theme}}));return theme;
  }
  function initialAppTheme(){const saved=localGet(APP_THEME_KEY);if(saved)return normalizeAppTheme(saved);try{return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{return 'light';}}
  applyAppTheme(initialAppTheme(),false);
  function showSettingsPage(page='general'){
    settingsActivePage=SETTINGS_PAGE_META[page]?page:'general';
    document.querySelectorAll('#controlPaneSettings [data-settings-page]').forEach(x=>{const active=x.dataset.settingsPage===settingsActivePage;x.hidden=!active;});
    document.querySelectorAll('#settingsModalMenu [data-settings-nav]').forEach(b=>b.classList.toggle('active',b.dataset.settingsNav===settingsActivePage));
    const meta=SETTINGS_PAGE_META[settingsActivePage]||SETTINGS_PAGE_META.general;if($('settingsPageTitle'))$('settingsPageTitle').textContent=meta[0];if($('settingsPageSubtitle'))$('settingsPageSubtitle').textContent=meta[1];
    applyAppTheme(document.documentElement.dataset.theme||initialAppTheme(),false);
  }
  function syncSettingsModalPermissions(){
    const ai=$('settingsIntelligenceSection'),aiNav=document.querySelector('[data-settings-nav="intelligence"]');if(aiNav)aiNav.hidden=Boolean(ai?.dataset.permissionHidden==='true');
  }
  function bindSettingsModalUi(){
    const pane=$('controlPaneSettings');if(!pane||pane.dataset.settingsBound==='true')return;pane.dataset.settingsBound='true';
    $('settingsModalClose')?.addEventListener('click',closeControlDrawer);
    $('settingsModalMenu')?.addEventListener('click',e=>{const b=e.target.closest('[data-settings-nav]');if(!b||b.hidden)return;showSettingsPage(b.dataset.settingsNav);});
    $('settingsSearch')?.addEventListener('input',e=>{const q=String(e.target.value||'').trim().toLowerCase();document.querySelectorAll('#settingsModalMenu [data-settings-nav]').forEach(b=>{if(b.dataset.permissionHidden==='true')return;b.hidden=Boolean(q&&!b.textContent.toLowerCase().includes(q));});});
    pane.addEventListener('click',e=>{const b=e.target.closest('[data-theme-choice]');if(!b)return;applyAppTheme(b.dataset.themeChoice,true);toast('Appearance changed to '+b.dataset.themeChoice+' mode.');});
  }
`;

function patchApp(file){
  let source=readFileSync(file,'utf8'),original=source;
  if(!source.includes('APP_THEME_KEY=\'assurance-regent-appearance-v1\'')){
    const anchor='  function renderSettingsPane(){';if(!source.includes(anchor))throw new Error(`renderSettingsPane anchor missing in ${basename(file)}.`);source=source.replace(anchor,`${helper}\n${anchor}`);
  }
  source=source.replace("document.body.classList.toggle('control-profile-open',panel==='profile');document.body.classList.toggle('control-agent-hidden',agentHiddenPanels.has(panel));","document.body.classList.toggle('control-profile-open',panel==='profile');document.body.classList.toggle('control-settings-open',panel==='settings');document.body.classList.toggle('control-agent-hidden',agentHiddenPanels.has(panel));");
  source=source.replace("document.body.classList.remove('control-profile-open','control-agent-hidden');","document.body.classList.remove('control-profile-open','control-settings-open','control-agent-hidden');");
  source=source.replace("if(panel==='settings')renderSettingsPane();","if(panel==='settings'){renderSettingsPane();bindSettingsModalUi();showSettingsPage(settingsActivePage||'general');}");
  const renderEnd="if($('settingsRetrainIntelligence'))$('settingsRetrainIntelligence').disabled=!can;\n    fillAccessUserFields();loadIntelligenceStatus();";
  if(source.includes(renderEnd))source=source.replace(renderEnd,"if($('settingsRetrainIntelligence'))$('settingsRetrainIntelligence').disabled=!can;\n    const aiSection=$('settingsIntelligenceSection'),aiNav=document.querySelector('[data-settings-nav=\\\"intelligence\\\"]');if(aiSection){aiSection.dataset.permissionHidden=can?'false':'true';if(settingsActivePage!=='intelligence')aiSection.hidden=true;}if(aiNav){aiNav.dataset.permissionHidden=can?'false':'true';aiNav.hidden=!can;}\n    fillAccessUserFields();loadIntelligenceStatus();applyAppTheme(document.documentElement.dataset.theme||initialAppTheme(),false);");
  if(!source.includes("classList.toggle('control-settings-open',panel==='settings')")||!source.includes('function showSettingsPage(')||!source.includes('data-theme-choice'))throw new Error(`Settings modal runtime patch incomplete in ${basename(file)}.`);
  if(source!==original)writeFileSync(file,source,'utf8');
  console.log(`[settings-modal] ${basename(file)} centered-settings=enabled theme-persistence=enabled`);
}

for(const file of htmlTargets)patchHtml(file);
for(const file of appTargets.filter(existsSync))patchApp(file);
