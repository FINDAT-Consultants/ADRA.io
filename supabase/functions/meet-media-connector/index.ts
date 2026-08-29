const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS'
};
Deno.serve((req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  return new Response(JSON.stringify({
    error:'Google Meet Media integration has been removed. Assurance Regent now uses the standard Google Workspace authorization and interview assistant flow.',
    code:'MEET_MEDIA_REMOVED'
  }),{status:410,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
});
