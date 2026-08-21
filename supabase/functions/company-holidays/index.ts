import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const body=await req.json().catch(()=>({})),token=String(body?.session_token||'').trim(),countryCode=String(body?.country_code||'').trim().toUpperCase(),currency=String(body?.currency||'').trim().toUpperCase(),year=Number(body?.year);
    if(!token)return json(401,{ok:false,error:'A signed-in Assurance Regent session is required.'});
    if(!Number.isInteger(year)||year<2000||year>2100)return json(400,{ok:false,error:'A valid calendar year is required.'});
    if(!/^[A-Z]{2}$/.test(countryCode))return json(400,{ok:false,error:'A valid ISO country code is required.'});

    const supabaseUrl=Deno.env.get('SUPABASE_URL')||'',anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
    if(!supabaseUrl||!anonKey)return json(500,{ok:false,error:'Holiday service authentication is not configured.'});
    const sessionResponse=await fetch(`${supabaseUrl}/rest/v1/rpc/assurance_regent_browser_session_status`,{method:'POST',headers:{apikey:anonKey,'content-type':'application/json'},body:JSON.stringify({p_token:token})});
    if(!sessionResponse.ok)return json(401,{ok:false,error:'Your Assurance Regent session is not valid.'});
    const session=await sessionResponse.json().catch(()=>null);
    if(!session?.ok||!session?.userId)return json(401,{ok:false,error:'Your Assurance Regent session is not valid.'});

    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);let holidayResponse:Response;
    try{holidayResponse=await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,{headers:{accept:'application/json'},signal:controller.signal});}finally{clearTimeout(timer);}
    if(!holidayResponse.ok){const detail=await holidayResponse.text().catch(()=>'');return json(502,{ok:false,error:`Public holiday provider returned ${holidayResponse.status}.`,detail:detail.slice(0,300)});}
    const raw=await holidayResponse.json();if(!Array.isArray(raw))return json(502,{ok:false,error:'Public holiday provider returned an unexpected response.'});
    const holidays=raw.map((h:any)=>({date:String(h?.date||'').slice(0,10),localName:String(h?.localName||''),name:String(h?.name||''),fixed:Boolean(h?.fixed),global:Boolean(h?.global),counties:Array.isArray(h?.counties)?h.counties:[],launchYear:h?.launchYear??null,types:Array.isArray(h?.types)?h.types:[]})).filter((h:any)=>/^\d{4}-\d{2}-\d{2}$/.test(h.date));
    return json(200,{ok:true,year,countryCode,currency,companyId:String(session.companyId||''),source:'Nager.Date',holidays});
  }catch(err){return json(500,{ok:false,error:err instanceof Error?err.message:'Public holiday lookup failed.'});}
});
