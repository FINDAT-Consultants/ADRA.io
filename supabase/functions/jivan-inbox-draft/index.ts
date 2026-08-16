// Assurance Regent v6.3.27 — Jivan internal Inbox drafting helper.
// Drafts only. A human must still press Send in the Inbox to deliver the message.
declare const Deno: any;

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const env=(name:string)=>String(Deno.env.get(name)||'').trim();
function publishableKey(){
  const raw=env('SUPABASE_PUBLISHABLE_KEYS');
  if(raw){try{const keys=JSON.parse(raw);if(keys.default)return String(keys.default);const first=Object.values(keys)[0];if(first)return String(first);}catch{}}
  return env('SUPABASE_PUBLISHABLE_KEY')||env('SUPABASE_ANON_KEY');
}
async function rpc(name:string,payload:any={}){
  const url=env('SUPABASE_URL'),key=publishableKey();if(!url||!key)throw new Error('Supabase project environment is unavailable.');
  const r=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(payload)});
  const text=await r.text();let body:any=null;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!r.ok)throw new Error(body?.message||body?.error||`Supabase RPC ${name} failed (${r.status}).`);return body;
}
function outputText(response:any){
  if(typeof response?.output_text==='string'&&response.output_text.trim())return response.output_text.trim();
  const parts:string[]=[];for(const item of response?.output||[])for(const content of item?.content||[])if((content?.type==='output_text'||content?.type==='text')&&typeof content?.text==='string')parts.push(content.text);return parts.join('\n').trim();
}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return json({error:'POST is required.'},405);
  try{
    const z=await req.json().catch(()=>({})),token=String(z.session_token||'').trim(),recipientId=String(z.recipient_id||'').trim(),instruction=String(z.instruction||'').trim();
    if(!token)return json({error:'Sign in to Assurance Regent before using Jivan drafting.'},401);
    if(!recipientId)return json({error:'Select the internal recipient first.'},400);
    if(!instruction)return json({error:'Write a short instruction or rough message for Jivan to refine.'},400);
    if(instruction.length>3500)return json({error:'Keep the drafting instruction under 3,500 characters.'},400);
    const actor=await rpc('assurance_regent_browser_actor_from_token',{p_token:token});
    const bundle=await rpc('assurance_regent_browser_message_bundle',{p_token:token});
    const recipient=(Array.isArray(bundle?.recipients)?bundle.recipients:[]).find((x:any)=>String(x?.id||'')===recipientId);
    if(!recipient)return json({error:'That recipient is not available in your permitted internal directory.'},403);
    const apiKey=env('OPENAI_API_KEY');if(!apiKey)return json({error:'Jivan drafting is unavailable because OPENAI_API_KEY is not configured.'},503);
    const model=env('OPENAI_MODEL')||'gpt-5.1';
    const prompt=`Draft a concise professional internal company message from ${String(actor?.name||actor?.id||'the sender').slice(0,120)} to ${String(recipient?.name||recipientId).slice(0,120)}.\n\nUSER'S ROUGH INSTRUCTION OR MESSAGE:\n${instruction}\n\nRules:\n- Use only information supplied in the instruction; do not invent deadlines, approvals, facts, accusations, performance claims, legal conclusions, or sensitive HR/finance details.\n- Keep it compact: normally 1 to 3 short sentences, maximum 450 characters unless the instruction clearly needs slightly more.\n- Be professional and natural.\n- Do not say you are AI or mention Jivan.\n- Do not send anything. Return only the proposed message text for human review.`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,input:prompt,store:false,max_output_tokens:260})});
    const text=await r.text();let data:any=null;try{data=text?JSON.parse(text):null}catch{data={error:{message:text}}}
    if(!r.ok)throw new Error(data?.error?.message||`Jivan drafting failed (${r.status}).`);
    const draft=outputText(data).replace(/^['“”]|['“”]$/g,'').trim();if(!draft)throw new Error('Jivan did not return a message draft.');
    return json({ok:true,draft:draft.slice(0,900),recipient:{id:recipientId,name:recipient?.name||recipientId},approval_required:true,sent:false,model});
  }catch(error:any){return json({error:String(error?.message||error||'Jivan drafting failed.')},400)}
});
