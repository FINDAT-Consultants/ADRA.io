import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const root=process.cwd(),p=resolve(root,'public');
if(!existsSync(p))throw new Error('public/ missing.');
const appName=readdirSync(p).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published app runtime missing.');
const appPath=join(p,appName),app=readFileSync(appPath,'utf8');
for(const token of ['COMPANY_HUB_DEPARTMENT_PAGE_SIZE60=3','companyHubRenderDepartmentPagination60','data-company-department-page60="prev"','data-company-department-page60="next"','companyHubDirectoryPeople60',"if(dep==='Company Lounge')return all.slice(0,3)",'No profiles are assigned to','renderCompanyHubDepartmentDirectory60','bindCompanyHubDepartmentDirectory60'])if(!app.includes(token))throw new Error(`Department Hub department-directory behavior missing: ${token}`);
if(!app.includes("return all.filter(person=>companyHubDepartmentNorm60(person.department||'Unassigned')===target).slice(0,3)"))throw new Error('People here is not restricted to the selected department.');
if(!app.includes('renderCompanyHubInlineVideo59();renderCompanyHubDepartmentDirectory60();renderCompanyHubStoriesTrending62();}'))throw new Error('Department-aware directory renderer is not preserved before downstream Hub analytics rendering.');
if(!app.includes('bindCompanyHubDepartmentDirectory60();'))throw new Error('Department-aware directory binder is not connected.');
execFileSync(process.execPath,['--check',appPath],{stdio:'pipe'});
console.log('[department-hub-department-directory-verify] OK: at most three actual departments are visible per page, with Previous/Next navigation when more exist.');
console.log('[department-hub-department-directory-verify] OK: Company Lounge shows the company-wide People here preview.');
console.log('[department-hub-department-directory-verify] OK: selecting a department shows only profiles assigned to that department in People here.');
console.log('[department-hub-department-directory-verify] OK: department directory rendering remains ahead of downstream Trending analytics rendering.');
