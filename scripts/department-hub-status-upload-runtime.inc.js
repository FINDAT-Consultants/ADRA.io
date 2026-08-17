  /* Assurance Regent v6.3.61 — Department Hub upload progress UI START */
  function companyHubUploadProgressTarget61(detail={}){
    const category=String(detail.category||'').toLowerCase();
    const story=document.getElementById('companyHubStoryComposeDialog');
    if(category.includes('status')&&story?.open)return story.querySelector('[data-company-story-compose-form]');
    const news=document.getElementById('companyHubProjectNewsComposeDialog');
    if(category.includes('project-news')&&news?.open)return news.querySelector('[data-company-project-news-form]');
    if(document.body.classList.contains('department-hub-social-mode'))return document.getElementById('companyHubForm');
    return null;
  }
  function companyHubUploadProgressHost61(target){
    if(!target)return null;let host=target.querySelector(':scope > .company-hub-upload-progress');if(host)return host;
    host=document.createElement('div');host.className='company-hub-upload-progress';host.hidden=true;host.setAttribute('role','progressbar');host.setAttribute('aria-valuemin','0');host.setAttribute('aria-valuemax','100');host.innerHTML='<span class="label">Preparing upload…</span><span class="percent">0%</span><span class="track"><span class="bar"></span></span>';
    const actions=target.querySelector(':scope > .company-hub-modal-actions');if(actions)target.insertBefore(host,actions);else target.appendChild(host);return host;
  }
  function companyHubHandleUploadProgress61(event){
    const detail=event?.detail||{},target=companyHubUploadProgressTarget61(detail);if(!target)return;const host=companyHubUploadProgressHost61(target);if(!host)return;
    const pct=Math.max(0,Math.min(100,Number(detail.percent||0))),name=String(detail.name||'File'),phase=String(detail.phase||'uploading');host.hidden=false;host.classList.toggle('done',phase==='done');host.classList.toggle('error',phase==='error');host.setAttribute('aria-valuenow',String(Math.round(pct)));const label=host.querySelector('.label'),percent=host.querySelector('.percent'),bar=host.querySelector('.bar');if(label)label.textContent=phase==='error'?`Upload failed · ${name}`:phase==='done'?`Uploaded · ${name}`:`Uploading ${name}`;if(percent)percent.textContent=phase==='error'?'Error':`${Math.round(pct)}%`;if(bar)bar.style.width=`${pct}%`;
    clearTimeout(host._companyHubHideTimer61);if(phase==='done')host._companyHubHideTimer61=setTimeout(()=>{host.hidden=true;host.classList.remove('done','error');if(bar)bar.style.width='0%';if(percent)percent.textContent='0%';},650);else if(phase==='error')host._companyHubHideTimer61=setTimeout(()=>{host.hidden=true;host.classList.remove('done','error');},2500);
  }
  if(!window.__assuranceRegentDepartmentHubUploadProgress61){window.__assuranceRegentDepartmentHubUploadProgress61=true;window.addEventListener('assurance-regent-upload-progress',companyHubHandleUploadProgress61);}
  /* Assurance Regent v6.3.61 — Department Hub upload progress UI END */
