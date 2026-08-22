  /* Assurance Regent v6.3.119 — durable runtime state persistence START */
  const SYSTEM_RUNTIME_STABILITY_SCHEMA119='6.3.119';
  const managedFetchBefore119=managedFetch;
  let standaloneSaveGeneration119=0;
  let standalonePendingGeneration119=0;
  let standaloneCommittedGeneration119=0;
  let standaloneSaveLastError119=null;
  let standaloneSaveRetryCount119=0;
  const STANDALONE_SAVE_MAX_RETRIES119=6;

  async function criticalStateWriteFetch119(url,init={},options={}){
    const timeout=Math.max(12000,Math.min(30000,Number(options.timeout||20000)));
    const retries=Math.max(2,Math.min(3,Number(options.retries||2)));
    let attempt=0,lastError=null;
    while(attempt<=retries){
      try{
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort('state-write-timeout'),timeout);
        let response;
        try{response=await RAW_FETCH(url,{...init,signal:controller.signal});}finally{clearTimeout(timer);}
        if((response.status===429||response.status>=500)&&attempt<retries){
          const retryAfter=Math.min(2500,Math.max(0,Number(response.headers.get('retry-after')||0)*1000));
          await sleep(retryAfter||Math.min(2200,220*(2**attempt)+Math.floor(Math.random()*140)));
          attempt+=1;continue;
        }
        return response;
      }catch(err){
        lastError=err;
        if(attempt>=retries)throw err;
        await sleep(Math.min(2200,220*(2**attempt)+Math.floor(Math.random()*140)));
        attempt+=1;
      }
    }
    throw lastError||new Error('Critical Assurance Regent state write failed.');
  }

  managedFetch=async function(url,init={},options={}){
    const isStateWrite=/\/rest\/v1\/rpc\/assurance_regent_browser_write_state(?:\?|$)/u.test(String(url||''));
    if(isStateWrite)return criticalStateWriteFetch119(url,init,{...options,timeout:20000,retries:2});
    return managedFetchBefore119(url,init,options);
  };

  function scheduleStandaloneSave119(delay=120){
    if(standaloneSaveTimer)clearTimeout(standaloneSaveTimer);
    standaloneSaveTimer=setTimeout(()=>{standaloneSaveTimer=null;void flushStandaloneSave();},Math.max(40,Number(delay||120)));
  }

  function adoptAuthoritativeLiveState119(value,generation){
    if(!value||typeof value!=='object'||!value.live||typeof value.live!=='object')return false;
    if(standaloneSavePending||generation!==standaloneSaveGeneration119)return false;
    previewMemory.live=JSON.parse(JSON.stringify(value.live));
    engine.replaceState(previewMemory.live);
    if(state.view==='onboarding'&&typeof renderOnboarding==='function')renderOnboarding();
    if(state.view==='employees'&&typeof renderEmployees==='function')renderEmployees();
    if(state.view==='company'&&typeof renderCompany==='function')renderCompany();
    return true;
  }

  queueStandaloneSave=function(){
    if(!browserSessionToken)return Promise.resolve();
    standaloneSavePending=standaloneSnapshot();
    standalonePendingGeneration119=++standaloneSaveGeneration119;
    scheduleStandaloneSave119(120);
    return standaloneSaveQueue;
  };

  flushStandaloneSave=function(){
    if(standaloneSaveTimer){clearTimeout(standaloneSaveTimer);standaloneSaveTimer=null;}
    if(!browserSessionToken||!standaloneSavePending)return standaloneSaveQueue;
    if(standaloneSaveInFlight)return standaloneSaveQueue;
    const snapshot=standaloneSavePending,sendGeneration=standalonePendingGeneration119||standaloneSaveGeneration119;
    standaloneSavePending=null;
    standaloneSaveInFlight=true;
    standaloneSaveQueue=supabaseRpc('assurance_regent_browser_write_state',{p_token:browserSessionToken,p_value:snapshot},{bypassCache:true,timeout:20000})
      .then(serverState=>{
        standaloneCommittedGeneration119=Math.max(standaloneCommittedGeneration119,sendGeneration);
        standaloneSaveLastError119=null;
        standaloneSaveRetryCount119=0;
        adoptAuthoritativeLiveState119(serverState,sendGeneration);
        window.dispatchEvent(new CustomEvent('assurance-regent-state-persisted',{detail:{schema:SYSTEM_RUNTIME_STABILITY_SCHEMA119,generation:sendGeneration,committedGeneration:standaloneCommittedGeneration119}}));
        return serverState;
      })
      .catch(err=>{
        standaloneSaveLastError119=err;
        standaloneSaveRetryCount119+=1;
        if(!standaloneSavePending||standalonePendingGeneration119<=sendGeneration){
          standaloneSavePending=snapshot;
          standalonePendingGeneration119=sendGeneration;
        }
        console.error('Durable Supabase state save failed; snapshot retained for retry.',err);
        if(typeof reportClientIncident==='function')void reportClientIncident('browser-state-persistence',err?.message||String(err),{schema:SYSTEM_RUNTIME_STABILITY_SCHEMA119,generation:sendGeneration,retry:standaloneSaveRetryCount119},'HIGH');
        if(browserSessionToken&&standaloneSaveRetryCount119<=STANDALONE_SAVE_MAX_RETRIES119){
          scheduleStandaloneSave119(Math.min(5000,250*(2**Math.min(standaloneSaveRetryCount119,4))));
        }else if(typeof toast==='function')toast('Supabase has not confirmed the latest change. The change is retained locally for recovery; keep this tab open and check your connection.');
        return null;
      })
      .finally(()=>{
        standaloneSaveInFlight=false;
        if(standaloneSavePending&&!standaloneSaveTimer&&standaloneSaveLastError119===null)scheduleStandaloneSave119(60);
        else if(standaloneSavePending&&!standaloneSaveTimer&&standaloneSaveRetryCount119<=STANDALONE_SAVE_MAX_RETRIES119)scheduleStandaloneSave119(Math.min(5000,250*(2**Math.min(standaloneSaveRetryCount119,4))));
      });
    return standaloneSaveQueue;
  };

  async function flushStandaloneSaveDurable119(maxAttempts=7){
    if(!STANDALONE_MODE||!browserSessionToken)return true;
    let attempts=0;
    while(attempts<Math.max(1,Number(maxAttempts||7))){
      if(standaloneSaveTimer){clearTimeout(standaloneSaveTimer);standaloneSaveTimer=null;}
      if(standaloneSaveInFlight)await standaloneSaveQueue;
      if(standaloneSavePending){
        await flushStandaloneSave();
        if(standaloneSaveInFlight)await standaloneSaveQueue;
      }
      if(!standaloneSavePending&&!standaloneSaveInFlight&&!standaloneSaveLastError119)return true;
      attempts+=1;
      if(standaloneSavePending)await sleep(Math.min(1200,100*(2**Math.min(attempts,3))));
    }
    throw standaloneSaveLastError119||new Error('Supabase did not confirm the latest Assurance Regent state change.');
  }

  if(typeof flushStandaloneSaveFully118==='function')flushStandaloneSaveFully118=()=>flushStandaloneSaveDurable119(7);
  window.addEventListener('online',()=>{if(browserSessionToken&&standaloneSavePending)void flushStandaloneSaveDurable119(7).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&browserSessionToken&&standaloneSavePending)void flushStandaloneSave();});
  window.addEventListener('pagehide',()=>{if(browserSessionToken&&standaloneSavePending)void flushStandaloneSave();});

  window.AssuranceRegentRuntimeStability={
    schema:SYSTEM_RUNTIME_STABILITY_SCHEMA119,
    criticalStateWriteLane:true,
    failedSnapshotsRetained:true,
    boundedRetry:true,
    authoritativeServerStateAdoption:true,
    onboardingActiveStateInvariant:true,
    get pending(){return Boolean(standaloneSavePending);},
    get inFlight(){return Boolean(standaloneSaveInFlight);},
    get generation(){return standaloneSaveGeneration119;},
    get committedGeneration(){return standaloneCommittedGeneration119;},
    get lastError(){return standaloneSaveLastError119?String(standaloneSaveLastError119.message||standaloneSaveLastError119):'';},
    flush:()=>flushStandaloneSaveDurable119(7)
  };
  /* Assurance Regent v6.3.119 — durable runtime state persistence END */
