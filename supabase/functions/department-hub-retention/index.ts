declare const Deno: any;

const BUCKET_FALLBACK='assurance-regent-files';
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-retention-key',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'content-type':'application/json','cache-control':'no-store'}});
const env=(name:string)=>String(Deno.env.get(name)||'').trim();
const base=()=>env('SUPABASE_URL').replace(/\/$/,'');
const serviceKey=()=>env('SUPABASE_SERVICE_ROLE_KEY');
const q=(v:any)=>encodeURIComponent(String(v??''));
const headers=(extra:Record<string,string>={})=>({apikey:serviceKey(),Authorization:`Bearer ${serviceKey()}`,...extra});
async function sf(path:string,init:any={}){
  const r=await fetch(base()+path,{...init,headers:{...headers(),...(init.headers||{})}}),text=await r.text();let body:any=null;
  try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!r.ok)throw new Error(body?.message||body?.error||String(body||`HTTP ${r.status}`));
  return body;
}
const rpc=(name:string,payload:any={})=>sf(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
async function patchQueue(fileId:string,body:any){return sf(`/rest/v1/assurance_regent_department_social_retention_queue?file_id=eq.${q(fileId)}`,{method:'PATCH',headers:{'content-type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)});}
async function deleteStorage(bucket:string,paths:string[]){
  if(!paths.length)return;
  const r=await fetch(`${base()}/storage/v1/object/${encodeURIComponent(bucket)}`,{method:'DELETE',headers:headers({'content-type':'application/json'}),body:JSON.stringify({prefixes:paths})});
  if(r.ok||r.status===404)return;
  const text=await r.text();throw new Error(text||`Storage deletion failed (${r.status}).`);
}

Deno.serve(async(req:any)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return json({error:'POST is required.'},405);
  try{
    const secret=String(req.headers.get('x-retention-key')||'').trim();
    const authorized=await rpc('assurance_regent_department_social_retention_authorized',{p_secret:secret});
    if(authorized!==true) return json({error:'Retention scheduler authorization failed.'},403);

    const sweep=await rpc('assurance_regent_department_social_retention_sweep');
    const queue:any[]=await sf('/rest/v1/assurance_regent_department_social_retention_queue?status=in.(PENDING,RETRY)&select=file_id,bucket_id,storage_path,attempts&order=queued_at.asc&limit=250',{headers:{accept:'application/json'}})||[];
    let deleted=0,failed=0;
    const grouped=new Map<string,any[]>();
    for(const row of queue){const bucket=String(row.bucket_id||BUCKET_FALLBACK);if(!grouped.has(bucket))grouped.set(bucket,[]);grouped.get(bucket)!.push(row);}
    for(const [bucket,rows] of grouped){
      try{
        await deleteStorage(bucket,rows.map((r:any)=>String(r.storage_path||'')).filter(Boolean));
        const now=new Date().toISOString();
        for(const row of rows){await patchQueue(String(row.file_id),{status:'DELETED',deleted_at:now,last_error:'',attempts:Number(row.attempts||0)+1});deleted++;}
      }catch(err:any){
        for(const row of rows){await patchQueue(String(row.file_id),{status:'RETRY',last_error:String(err?.message||err).slice(0,1000),attempts:Number(row.attempts||0)+1}).catch(()=>{});failed++;}
      }
    }
    return json({ok:true,policy_days:30,sweep,storage_queue:queue.length,storage_deleted:deleted,storage_failed:failed});
  }catch(err:any){return json({error:String(err?.message||err||'Department Hub retention failed.')},500);}
});
