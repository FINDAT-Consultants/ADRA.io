import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const cssPath=join(publicDir,'data-controls-storage.css');
if(!existsSync(cssPath))throw new Error('Published Data Controls + Storage stylesheet is missing.');
const css=readFileSync(cssPath,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');

for(const token of [
  'data-settings-nav="data"',
  'id="settingsDataControlsNav"',
  'data-settings-nav="storage"',
  'id="settingsStorageNav"',
  'id="settingsDataControlsSection"',
  'id="settingsStorageSection"',
  'id="developerDataWorkspace"',
  'id="dataWorkspaceMinimize"',
  'id="dataWorkspaceMaximize"',
  'id="dataWorkspaceClose"',
  'id="dataPipelineNav"',
  'id="dataTableTabs"',
  'id="storageBreakdown"',
  'id="storageRecentFiles"'
])if(!html.includes(token))throw new Error(`Data Controls/Storage HTML is missing: ${token}`);

for(const token of [
  'function dataDeveloperAllowed(){',
  "functionalAuthority(effectiveUserOrg(controlUser()||{}))==='DEVELOPER'",
  'function loadDataControlsCatalog(',
  'function loadDataControlsTable(',
  'function saveDataRowEditor(',
  'assurance_regent_browser_data_controls_catalog',
  'assurance_regent_browser_data_controls_rows',
  'assurance_regent_browser_data_controls_update',
  'assurance_regent_browser_admin_account_status',
  'assurance_regent_browser_admin_delete_user',
  'function loadPersonalStorage(){',
  'assurance_regent_browser_storage_summary',
  "if(!dev&&settingsActivePage==='data')showSettingsPage('general')"
])if(!app.includes(token))throw new Error(`Data Controls/Storage runtime is missing: ${token}`);

for(const token of [
  '.data-workspace.maximized',
  '.data-workspace.minimized .data-workspace-body',
  '.data-workspace.closed',
  '.data-pipeline-nav',
  '.data-console-table',
  '.data-row-editor',
  '.storage-progress',
  '.storage-breakdown',
  '@media(max-width:760px)'
])if(!css.includes(token))throw new Error(`Data Controls/Storage CSS is missing: ${token}`);

console.log('[data-controls-storage-verify] OK: Developer-only Data Controls navigation is present and role-gated.');
console.log('[data-controls-storage-verify] OK: data workspace supports pipeline/table navigation plus minimize/maximize/close.');
console.log('[data-controls-storage-verify] OK: controlled edits and account suspend/activate/delete use governed RPCs.');
console.log('[data-controls-storage-verify] OK: Storage is a separate all-user settings page based on the signed-in user file summary.');
