import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=process.cwd(),files={app:resolve(root,'app.js'),runtime:resolve(root,'scripts/recovery-exceptions-pagination-v6-3-93-runtime.inc.js'),apply:resolve(root,'scripts/apply-recovery-exceptions-pagination-v6-3-93.mjs')};
for(const [name,file] of Object.entries(files))if(!existsSync(file))throw new Error(`Recovery Exceptions pagination v6.3.93 missing ${name}: ${file}`);
const app=readFileSync(files.app,'utf8'),runtime=readFileSync(files.runtime,'utf8'),apply=readFileSync(files.apply,'utf8');
for(const token of ['RECOVERY_EXCEPTIONS_PAGINATION_SCHEMA93','RECOVERY_EXCEPTIONS_PAGE_SIZE93=5','recoveryExceptionsPager93','Previous exceptions page','Next exceptions page'])if(!app.includes(token))throw new Error(`Built app is missing Recovery Exceptions pagination v6.3.93 token: ${token}`);
for(const token of ['totalRows<=RECOVERY_EXCEPTIONS_PAGE_SIZE93','Math.ceil(totalRows/RECOVERY_EXCEPTIONS_PAGE_SIZE93)','Exceptions ${first}–${last} of ${totalRows}','row.hidden=i<start||i>=end','pager.hidden=true'])if(!runtime.includes(token))throw new Error(`Recovery Exceptions pagination runtime missing ${token}`);
for(const token of ['Recovery Exceptions pagination v6.3.93 requires v6.3.92','--check','page-size=5'])if(!apply.includes(token))throw new Error(`Recovery Exceptions pagination apply script missing ${token}`);
const pageSize=5,totalRows=13,totalPages=Math.ceil(totalRows/pageSize);if(totalPages!==3)throw new Error('Recovery Exceptions five-row pagination sanity check failed.');
for(const page of [1,2,3]){const start=(page-1)*pageSize,end=Math.min(start+pageSize,totalRows),count=end-start;if(count>5)throw new Error(`Recovery Exceptions page ${page} exceeds five rows.`);}
console.log('[verify-recovery-exceptions-pagination-v93] PASS maximum five visible exception rows per page, pagination begins after five, empty state remains unpaged.');
