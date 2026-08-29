import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
const runtime=resolve(root,'scripts/department-hub-department-directory-runtime.inc.js');
if(!existsSync(runtime))throw new Error('Department Hub department-directory runtime is missing.');

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s,addon=readFileSync(runtime,'utf8').trimEnd();
  const block=/  \/\* Assurance Regent v6\.3\.60 — three-department paging and department-aware directory START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.60 — three-department paging and department-aware directory END \*\//u;
  if(block.test(s))s=s.replace(block,addon);
  else{
    const anchor='  function renderExtendedProfileFields()';
    if(!s.includes(anchor))throw new Error(`Department Hub department-directory runtime anchor missing in ${basename(file)}.`);
    s=s.replace(anchor,addon+'\n'+anchor);
  }
  if(s.includes('renderCompanyHubInlineVideo59();}')&&!s.includes('renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();}'))s=s.replace('renderCompanyHubInlineVideo59();}','renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();}');
  const bind=/  function bindAiCompanyHubUi\(\)\{[^\n]*\}/u;
  if(bind.test(s)){
    let current=s.match(bind)?.[0]||'';
    if(!current.includes('bindCompanyHubDepartmentDirectory60()'))current=current.slice(0,-1)+'bindCompanyHubDepartmentDirectory60();}';
    s=s.replace(bind,current);
  }
  for(const token of ['COMPANY_HUB_DEPARTMENT_PAGE_SIZE60=3','companyHubRenderDepartmentPagination60','data-company-department-page60','companyHubDirectoryPeople60','companyHubRenderDirectory60','renderCompanyHubDepartmentDirectory60','bindCompanyHubDepartmentDirectory60'])if(!s.includes(token))throw new Error(`Department Hub department-directory runtime missing ${token} in ${basename(file)}.`);
  if(!s.includes('renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();}'))throw new Error(`Department Hub department-directory render hook missing in ${basename(file)}.`);
  if(!s.includes('bindCompanyHubDepartmentDirectory60();'))throw new Error(`Department Hub department-directory binder missing in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-department-directory] ${basename(file)} departments=three-per-page people-here=selected-department-only`);
}

for(const file of appTargets.filter(existsSync))patchApp(file);
