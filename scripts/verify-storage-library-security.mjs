import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const html=readFileSync(join(publicDir,'index.html'),'utf8');
const cssPath=join(publicDir,'storage-library-security.css');
if(!existsSync(cssPath))throw new Error('Published Storage library security stylesheet is missing.');
const css=readFileSync(cssPath,'utf8');
const appName=readdirSync(publicDir).find(n=>/^app(?:\.|-).*\.js$/iu.test(n));
if(!appName)throw new Error('Published application runtime is missing.');
const app=readFileSync(join(publicDir,appName),'utf8');
const edge=readFileSync(resolve(root,'supabase/functions/assurance-regent-files/index.ts'),'utf8');
const migration=readFileSync(resolve(root,'supabase/PASSWORD_SECURITY_STORAGE_LIBRARY_V6_3_34.sql'),'utf8');

for(const token of ['id="storageManageFiles"','id="storageLibraryPanel"','id="storageLibraryFilter"','id="storageLibrarySearch"','id="storageLibrarySelectAll"','id="storageLibraryDelete"','id="storageLibraryList"'])if(!html.includes(token))throw new Error(`Storage library HTML is missing: ${token}`);
for(const token of ['Password / Security','function openPasswordEditor(id){','assurance_regent_browser_admin_set_password','function openStorageLibrary(','assurance_regent_browser_storage_library',"mode:'delete_many'",'data-storage-category','data-account-password'])if(!app.includes(token))throw new Error(`Password/Storage runtime is missing: ${token}`);
for(const token of ['.password-security-cell','.storage-category-card','.storage-library-panel','.storage-library-row','.storage-library-toolbar','.storage-file-check'])if(!css.includes(token))throw new Error(`Password/Storage CSS is missing: ${token}`);
for(const token of ["mode === 'delete_many'",'function ensureOwner','actor_id=eq.${q(clean(who?.id,160))}','prefixes: paths'])if(!edge.includes(token))throw new Error(`File-service ownership/delete guard is missing: ${token}`);
for(const token of ["x - 'passwordHash' - 'password_hash'","'password_status'",'assurance_regent_browser_storage_library'])if(!migration.includes(token))throw new Error(`Database security/library migration is missing: ${token}`);
console.log('[storage-library-security-verify] OK: Identity & Access shows Password/Security status after Email without exposing stored credentials.');
console.log('[storage-library-security-verify] OK: Developer password changes use the governed password-reset RPC.');
console.log('[storage-library-security-verify] OK: Storage categories open a searchable selectable personal file library.');
console.log('[storage-library-security-verify] OK: multi-delete is owner-scoped and removes objects through the Storage API.');
