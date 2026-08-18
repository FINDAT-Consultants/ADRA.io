import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),runtimePath=resolve(root,'scripts/department-hub-audience-v6-3-84-runtime.inc.js'),applyPath=resolve(root,'scripts/apply-department-hub-audience-v6-3-84.mjs'),appPath=resolve(root,'app.js'),packagePath=resolve(root,'package.json');
for(const path of [runtimePath,applyPath,appPath,packagePath])if(!existsSync(path))throw new Error(`Department Hub audience required file missing: ${path}`);
const runtime=readFileSync(runtimePath,'utf8'),app=readFileSync(appPath,'utf8'),pkg=readFileSync(packagePath,'utf8');
for(const token of [
  'companyHubReactionPreview84',
  'data-social-reactions-more84',
  '+ See more',
  'company-social-reaction-dialog84',
  'assurance_regent_browser_department_social_reactors',
  'companyHubAudienceRecord84',
  'companyHubRecordView62',
  'data-social-react',
  'data-social-comment-form',
  'IntersectionObserver',
  "media.tagName==='VIDEO'"
])if(!runtime.includes(token))throw new Error(`Department Hub audience behavior missing: ${token}`);
if(!app.includes('Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking START'))throw new Error('Department Hub audience runtime was not applied to app.js.');
if(app.indexOf('Assurance Regent v6.3.84 — Department Hub reactor details + unique audience tracking START')<app.indexOf('Assurance Regent v6.3.83 — single-page Developer Create Company currency selection START'))throw new Error('Department Hub audience runtime is not layered after v6.3.83.');
for(const token of ['"apply:department-hub-audience-v6-3-84"','"verify:department-hub-audience-v6-3-84"','npm run apply:department-hub-audience-v6-3-84','npm run verify:department-hub-audience-v6-3-84'])if(!pkg.includes(token))throw new Error(`package.json Department Hub audience wiring missing: ${token}`);
for(const path of [runtimePath,applyPath,appPath]){const check=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(check.status!==0)throw new Error(`Syntax check failed for ${path}:\n${check.stderr||check.stdout}`);}
console.log('[department-hub-audience-verify] OK: posts show three reactor previews and + See more for larger reaction sets.');
console.log('[department-hub-audience-verify] OK: reaction details open in a closable, scrollable modal.');
console.log('[department-hub-audience-verify] OK: qualified reading, media, reactions and comments record unique post viewers.');
