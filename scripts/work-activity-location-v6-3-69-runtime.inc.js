  /* Assurance Regent v6.3.69 — reliable Work Activity clock location capture START */
  function workActivityLocationError69(err){
    const code=Number(err?.code||0);
    if(code===1)return new Error('Location access is blocked for this site. Enable Location in your browser site permissions, then try the clock action again.');
    if(code===2)return new Error('Your device could not determine its location. Turn on device Location/GPS or connect to a network with location services, then try again.');
    if(code===3)return new Error('Location capture timed out. Keep Location/GPS enabled and try the clock action again.');
    return err instanceof Error?err:new Error('A valid location could not be captured. Enable browser Location and try again.');
  }
  async function workActivityLocationPermission69(){
    if(!globalThis.isSecureContext)throw new Error('Location capture requires a secure HTTPS connection. Open the secure Work Activity Hub and try again.');
    if(!navigator.geolocation)throw new Error('This browser does not provide geolocation. Use a browser/device with Location enabled to clock in or out.');
    if(!navigator.permissions?.query)return 'unknown';
    try{
      const permission=await navigator.permissions.query({name:'geolocation'});
      if(permission?.state==='denied')throw workActivityLocationError69({code:1});
      return permission?.state||'unknown';
    }catch(err){
      if(/Location access is blocked/i.test(String(err?.message||'')))throw err;
      return 'unknown';
    }
  }
  function workActivityGeoFix69(options={}){
    return new Promise((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(position=>{
        const lat=Number(position?.coords?.latitude),lng=Number(position?.coords?.longitude),accuracy=Number(position?.coords?.accuracy||0);
        if(!Number.isFinite(lat)||!Number.isFinite(lng)){reject(new Error('The browser returned an invalid location. Try the clock action again.'));return;}
        resolve({lat,lng,accuracy_m:Number.isFinite(accuracy)?Math.max(0,Math.round(accuracy)):null,captured_at:new Date(position?.timestamp||Date.now()).toISOString()});
      },error=>reject(workActivityLocationError69(error)),options);
    });
  }
  async function workActivityLocationLabel69(fix){
    let label=`${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}`;
    try{
      const response=await managedFetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(fix.lat)}&lon=${encodeURIComponent(fix.lng)}&zoom=18&addressdetails=1`,{headers:{Accept:'application/json'}},{timeout:6500,retries:0});
      if(response.ok){const data=await response.json();if(String(data?.display_name||'').trim())label=String(data.display_name).trim();}
    }catch{}
    return label;
  }
  captureLocation=async function(){
    await workActivityLocationPermission69();
    let fix=null,firstError=null;
    try{
      fix=await workActivityGeoFix69({enableHighAccuracy:true,timeout:12000,maximumAge:15000});
    }catch(err){
      firstError=err;
      if(/blocked for this site/i.test(String(err?.message||'')))throw err;
    }
    if(!fix){
      try{fix=await workActivityGeoFix69({enableHighAccuracy:false,timeout:12000,maximumAge:300000});}
      catch(err){throw workActivityLocationError69(err||firstError);}
    }
    const label=await workActivityLocationLabel69(fix);
    return {...fix,label,source:'browser-geolocation'};
  };
  /* Assurance Regent v6.3.69 — reliable Work Activity clock location capture END */
