import {copyFileSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const runtimeFile=resolve(root,'scripts/budget-donor-import-v6-3-86-runtime.inc.js');
const cssFile=resolve(root,'budget-donor-import-v6-3-86.css');
const xlsxSource=resolve(root,'node_modules/xlsx/dist/xlsx.full.min.js');
if(!existsSync(runtimeFile)||!existsSync(cssFile))throw new Error('Budget & Donor import v6.3.86 assets are missing.');
if(!existsSync(xlsxSource))throw new Error('SheetJS 0.20.3 is not installed. Run npm install before the protected build.');

const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const block=/  \/\* Assurance Regent v6\.3\.86 — Budget & Donor Import UI \+ control reliability START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.86 — Budget & Donor Import UI \+ control reliability END \*\//u;
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(block.test(source))source=source.replace(block,runtime);else{
    const anchor='  /* Assurance Regent v6.3.85 — controlled Budget & Donor Excel imports + recovery budget feed END */';
    if(!source.includes(anchor))throw new Error(`Budget & Donor import v6.3.86 requires v6.3.85 in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${runtime}`);
  }
  for(const token of ['BUDGET_IMPORT_PAGE_SIZE86=5','BUDGET_IMPORT_XLSX_SELF86','./vendor/xlsx.full.min.js','budgetImportRefreshStatus86','data-budget-page86','renderBudgetImportPager86','downloadBudgetTemplate86'])if(!source.includes(token))throw new Error(`Budget & Donor import v6.3.86 missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Budget & Donor import v6.3.86 syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}

const cssTarget=resolve(publicDir,'budget-donor-import-v6-3-86.css');mkdirSync(dirname(cssTarget),{recursive:true});copyFileSync(cssFile,cssTarget);
const vendorTarget=resolve(publicDir,'vendor/xlsx.full.min.js');mkdirSync(dirname(vendorTarget),{recursive:true});copyFileSync(xlsxSource,vendorTarget);
const rootVendor=resolve(root,'vendor/xlsx.full.min.js');mkdirSync(dirname(rootVendor),{recursive:true});copyFileSync(xlsxSource,rootVendor);

for(const htmlFile of [resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync)){
  let html=readFileSync(htmlFile,'utf8');
  const link='  <link rel="stylesheet" href="./budget-donor-import-v6-3-86.css" data-budget-import-css86 />';
  if(!html.includes('data-budget-import-css86'))html=html.replace(/<\/head>/iu,`${link}\n</head>`);
  writeFileSync(htmlFile,html,'utf8');
}

console.log('[budget-donor-import-v86] static-css=enabled sheetjs=self-hosted controls=reliable pagination=5');

await import('./apply-budget-personnel-directory-v6-3-87.mjs');
