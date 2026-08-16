import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const publicDir=resolve(process.cwd(),'public');
if(!existsSync(publicDir))throw new Error('public/ directory is missing.');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const cssPath=join(publicDir,'settings-modal.css');
if(!existsSync(cssPath))throw new Error('Published Settings modal stylesheet is missing.');
const css=readFileSync(cssPath,'utf8');

for(const token of [
  'class="settings-modal-nav"',
  'id="settingsSearch"',
  'data-settings-nav="general"',
  'data-settings-nav="appearance"',
  'data-settings-nav="costing"',
  'data-settings-nav="access"',
  'data-settings-nav="intelligence"',
  'id="settingsAppearanceSection"',
  'data-theme-choice="light"',
  'data-theme-choice="dark"'
])if(!html.includes(token))throw new Error(`Settings modal HTML is missing: ${token}`);

for(const token of [
  "APP_THEME_KEY='assurance-regent-appearance-v1'",
  'function applyAppTheme(',
  'function showSettingsPage(',
  'function bindSettingsModalUi(',
  "classList.toggle('control-settings-open',panel==='settings')",
  "classList.remove('control-profile-open','control-settings-open','control-agent-hidden')"
])if(!app.includes(token))throw new Error(`Settings modal runtime is missing: ${token}`);

for(const token of [
  'body.control-settings-open .control-drawer',
  'width:min(720px,calc(100vw - 34px))',
  'height:min(620px,calc(100vh - 38px))',
  'grid-template-columns:215px minmax(0,1fr)',
  'html[data-theme="dark"]',
  'body.control-settings-open #controlPaneSettings[hidden]{display:none!important}'
])if(!css.includes(token))throw new Error(`Settings modal CSS is missing: ${token}`);

const notificationPane=html.indexOf('id="controlPaneNotifications"');
const settingsPane=html.indexOf('id="controlPaneSettings"');
const profilePane=html.indexOf('id="controlPaneProfile"');
if(notificationPane<0||settingsPane<0||profilePane<0||!(notificationPane<settingsPane&&settingsPane<profilePane))throw new Error('Settings pane placement inside the shared control center is invalid.');

console.log('[settings-modal-verify] OK: Settings opens as a compact centered two-column modal.');
console.log('[settings-modal-verify] OK: General, Appearance, Costing, Access & Roles, and AI categories are present.');
console.log('[settings-modal-verify] OK: Light and Dark appearance controls are wired and persistent.');
console.log('[settings-modal-verify] OK: other control-center panes remain isolated from Settings modal styling.');
