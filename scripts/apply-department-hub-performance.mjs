import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

const fastRuntime=`  /* Assurance Regent v6.3.46 — fast private Department Hub streaming. */
  const companySocialSignedCache=new Map();
  function companySocialTrimSignedCache(){while(companySocialSignedCache.size>120){const first=companySocialSignedCache.keys().next().value;if(first===undefined)break;companySocialSignedCache.delete(first);}}
  async function companySocialSignedFile(fileId){const id=String(fileId||'').trim();if(!id)throw new Error('Stored file reference is missing.');const now=Date.now(),hit=companySocialSignedCache.get(id);if(hit?.promise)return hit.promise;if(hit?.value&&Number(hit.expiresAt||0)>now+30000)return hit.value;const promise=persistentFileDownload(id).then(stored=>{const ttl=Math.max(60000,(Math.max(60,Number(stored?.expires_in||600))-45)*1000),entry={value:stored,expiresAt:Date.now()+ttl};companySocialSignedCache.set(id,entry);companySocialTrimSignedCache();return stored;}).catch(err=>{companySocialSignedCache.delete(id);throw err;});companySocialSignedCache.set(id,{promise,expiresAt:now+60000});return promise;}
  async function openCompanySocialFile(fileId,name='attachment'){const stored=await companySocialSignedFile(fileId),a=document.createElement('a');a.href=stored.url;a.target='_blank';a.rel='noopener';a.download=stored.name||name||'attachment';document.body.appendChild(a);a.click();a.remove();return stored;}
  async function hydrateCompanySocialMedia(){if(companySocialMediaHydrating)return;const nodes=[...document.querySelectorAll('[data-company-social-media]:not([data-media-ready])')];if(!nodes.length)return;companySocialMediaHydrating=true;try{const batch=nodes.slice(0,30);await Promise.allSettled(batch.map(async node=>{node.dataset.mediaReady='loading';try{const stored=await companySocialSignedFile(node.dataset.companySocialMedia),kind=node.dataset.mediaKind;if(kind==='image'){node.innerHTML='<img src="'+esc(stored.url)+'" alt="'+esc(stored.name||'Shared image')+'" loading="lazy" decoding="async"/>';node.dataset.companyHubFile=node.dataset.companySocialMedia;node.dataset.companyHubFileName=encodeURIComponent(stored.name||'image');}else if(kind==='video'){node.innerHTML='<video controls preload="metadata" playsinline src="'+esc(stored.url)+'"></video>';}node.dataset.mediaReady='true';}catch(err){node.innerHTML='<span class="media-loading">Media unavailable</span>';node.dataset.mediaReady='error';node.title=String(err?.message||'Could not load media.');}}));}finally{companySocialMediaHydrating=false;if(document.querySelector('[data-company-social-media]:not([data-media-ready])'))queueMicrotask(()=>hydrateCompanySocialMedia());}}`;

for(const file of appTargets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  const old=/  \/\* Assurance Regent v6\.3\.45 — CSP-safe private Department Hub attachments\. \*\/[\s\S]*?  async function hydrateCompanySocialMedia\(\)\{[^\n]*\}/u;
  const already=/Assurance Regent v6\.3\.46 — fast private Department Hub streaming/u.test(s);
  if(old.test(s))s=s.replace(old,fastRuntime);
  else if(!already)throw new Error(`Department Hub private-media runtime anchor missing in ${basename(file)}.`);
  if(!s.includes('companySocialSignedCache')||!s.includes('Promise.allSettled(batch.map')||!s.includes("preload=\"metadata\"")||!s.includes("a.target='_blank'"))throw new Error(`Fast Department Hub streaming patch incomplete in ${basename(file)}.`);
  if(s.includes('companySocialFileBlob(')||s.includes('URL.createObjectURL(blob)')||s.includes("managedFetch(stored.url,{method:'GET'}"))throw new Error(`Slow full-file blob delivery remains in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[department-hub-performance] ${basename(file)} signed-url-cache=enabled concurrent-hydration=enabled media-streaming=enabled`);
}
