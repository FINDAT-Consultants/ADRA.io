declare const Deno:any;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve((req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});return new Response(JSON.stringify({error:'This voice endpoint was retired. Zari uses the original sign-in/handoff browser voice path.'}),{status:410,headers:{...CORS,'content-type':'application/json','cache-control':'no-store'}});});
