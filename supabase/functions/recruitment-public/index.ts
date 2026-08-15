// Assurance Regent v6.3.23 — Direct Recruitment Email Delivery
declare const Deno:any;

const BUCKET='assurance-regent-recruitment-documents';
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
function json(body:any,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
function env(name:string){return String(Deno.env.get(name)||'').trim();}
function baseUrl(){const v=env('SUPABASE_URL');if(!v)throw new Error('SUPABASE_URL is not configured.');return v.replace(/\/$/,'');}
function serviceKey(){const v=env('SUPABASE_SERVICE_ROLE_KEY');if(!v)throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');return v;}
function headers(extra:any={}){const k=serviceKey();return {apikey:k,Authorization:`Bearer ${k}`,...extra};}
async function sf(path:string,init:any={}){const r=await fetch(`${baseUrl()}${path}`,{...init,headers:{...headers(),...(init.headers||{})}});const t=await r.text();let b:any=null;try{b=t?JSON.parse(t):null;}catch{b=t;}if(!r.ok)throw new Error(b?.message||b?.error||b?.hint||String(b||`Supabase request failed (${r.status}).`));return b;}
async function rpc(name:string,payload:any={}){return sf(`/rest/v1/rpc/${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});}
async function select(table:string,query:string){return sf(`/rest/v1/${table}?${query}`,{headers:{Accept:'application/json'}});}
async function insert(table:string,row:any){return sf(`/rest/v1/${table}`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});}
async function patch(table:string,query:string,row:any){return sf(`/rest/v1/${table}?${query}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});}
function clean(v:any,max=500){return String(v??'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max);}
function email(v:any){return clean(v,320).toLowerCase();}
function isEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function safeFileName(v:any){return clean(v,180).replace(/[^A-Za-z0-9._ -]/g,'_').replace(/\s+/g,'_')||'file';}
function outputText(data:any){if(typeof data?.output_text==='string')return data.output_text;for(const item of data?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')return c.text;}}return '';}
function decodeBase64(s:string,maxBytes:number,label='File'){const rawText=String(s||'');if(rawText.length>Math.ceil(maxBytes*1.38)+4096)throw new Error(`${label} is too large.`);const raw=atob(rawText);if(raw.length>maxBytes)throw new Error(`${label} is too large.`);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
function vacancyPublic(v:any){
  if(!v||v.publicVisible!==true||v.archived===true)return false;
  if(String(v.status||'Open').toLowerCase()!=='open')return false;
  const close=String(v.closeDate||'').slice(0,10);if(close&&/^\d{4}-\d{2}-\d{2}$/.test(close)&&close<new Date().toISOString().slice(0,10))return false;
  return true;
}
async function clientState(){const rows=await select('assurance_regent_state','state_key=eq.browser-client-state&select=state_value&limit=1');return rows?.[0]?.state_value||{};}
function rawVacancy(state:any,vacancyId:string){return (Array.isArray(state?.live?.vacancies)?state.live.vacancies:[]).find((v:any)=>String(v.id||'')===String(vacancyId||''))||null;}
function publicVacanciesFromState(state:any,companyId='',vacancyId=''){
  const companies=Array.isArray(state?.auth?.companies)?state.auth.companies:[];
  const companyMap=new Map(companies.map((c:any)=>[String(c.id||''),c]));
  const rows=Array.isArray(state?.live?.vacancies)?state.live.vacancies:[];
  return rows.filter((v:any)=>{const c:any=companyMap.get(String(v.companyId||''))||{};return vacancyPublic(v)&&c.active!==false&&c.systemEnabled!==false&&(!companyId||String(v.companyId||'')===companyId)&&(!vacancyId||String(v.id||'')===vacancyId);}).map((v:any)=>{
    const c:any=companyMap.get(String(v.companyId||''))||{};
    return {
      id:String(v.id||''),companyId:String(v.companyId||''),companyName:clean(c.name||'Assurance Regent Organization',160),companyLogo:clean(v.companyLogo||c.logo||c.profilePhoto||'',350000),
      jobReference:clean(v.jobReference||'',160),title:clean(v.title,200),department:clean(v.department,160),location:clean(v.location,160),employmentType:clean(v.employmentType||'Full Time',80),positionsCount:Math.max(1,Number(v.positionsCount||1)||1),
      openDate:String(v.openDate||'').slice(0,10),closeDate:String(v.closeDate||'').slice(0,10),experienceYears:Math.max(0,Number(v.experienceYears||0)||0),salaryRange:clean(v.salaryRange||'',300),reportingLine:clean(v.reportingLine||'',300),
      description:clean(v.publicDescription||'',10000),responsibilities:clean(v.publicResponsibilities||'',10000),requirements:clean(v.publicRequirements||'',10000),skills:clean(v.publicSkills||'',6000),education:clean(v.publicEducation||'',3000),benefits:clean(v.publicBenefits||'',5000),aboutCompany:clean(v.publicAboutCompany||'',5000)
    };
  });
}
async function uploadPrivate(path:string,bytes:Uint8Array,type:string){
  const r=await fetch(`${baseUrl()}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{...headers({'Content-Type':type||'application/octet-stream','x-upsert':'false'})},body:bytes});
  const t=await r.text();if(!r.ok){let b:any={};try{b=JSON.parse(t);}catch{}throw new Error(b?.message||b?.error||`Attachment upload failed (${r.status}).`);}
}
async function signedFile(path:string,seconds=600){
  const r=await fetch(`${baseUrl()}/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{...headers({'Content-Type':'application/json'})},body:JSON.stringify({expiresIn:seconds})});
  const t=await r.text();let b:any={};try{b=t?JSON.parse(t):{};}catch{}if(!r.ok)throw new Error(b?.message||b?.error||`Could not open recruitment document (${r.status}).`);
  const signed=String(b?.signedURL||b?.signedUrl||'');return signed.startsWith('http')?signed:`${baseUrl()}/storage/v1${signed}`;
}
function attachmentAllowed(name:string,type:string){const ext=(name.toLowerCase().split('.').pop()||'').replace(/[^a-z0-9]/g,''),blocked=new Set(['exe','com','bat','cmd','msi','scr','ps1','vbs','js','mjs','cjs','html','htm','svg','php','py','rb','pl','sh','jar','apk','dmg','iso']);if(blocked.has(ext))return false;if(/(?:javascript|x-sh|x-msdownload|x-executable|text\/html|image\/svg)/i.test(type))return false;return Boolean(ext)&&ext.length<=10;}
async function requestHash(req:any){const raw=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),salt=env('RECRUITMENT_RATE_LIMIT_SALT')||serviceKey().slice(-48),bytes=new TextEncoder().encode(`${raw}|${salt}`),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function hrBundle(token:string){if(!token)throw new Error('HR session is required.');return rpc('assurance_regent_browser_recruitment_bundle',{p_token:token});}
function applicantFromBundle(bundle:any,id:string){return (bundle?.applications||[]).find((x:any)=>String(x.id)===String(id))||null;}
async function openAi(prompt:string,max=2200){const key=env('OPENAI_API_KEY');if(!key)throw new Error('OPENAI_API_KEY is not configured for recruitment AI assistance.');const model=env('OPENAI_MODEL')||'gpt-5-mini';const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:prompt,store:false,max_output_tokens:max})});const t=await r.text();let b:any=null;try{b=t?JSON.parse(t):null;}catch{b={error:{message:t}};}if(!r.ok)throw new Error(b?.error?.message||`Recruitment AI request failed (${r.status}).`);return outputText(b);}
function parseJsonObject(text:string){const cleaned=String(text||'').replace(/```(?:json)?/gi,'').replace(/```/g,'').trim();try{return JSON.parse(cleaned);}catch{}const a=cleaned.indexOf('{'),z=cleaned.lastIndexOf('}');if(a>=0&&z>a)return JSON.parse(cleaned.slice(a,z+1));throw new Error('Recruitment AI returned an unreadable result.');}
function normalizePhone(v:any){return clean(v,100).replace(/[^0-9]/g,'');}
async function recordOutreach(row:any){try{await insert('assurance_regent_recruitment_outreach',row);}catch{} }
async function recruitmentSenderAddress(){
  const direct=env('RECRUITMENT_FROM_EMAIL')||env('JIVAN_EMAIL_FROM')||env('RESEND_FROM_EMAIL');
  if(direct)return direct;
  try{
    const rows=await select('assurance_regent_jivan_studio_versions','status=eq.ACTIVE&select=config&order=version_no.desc&limit=1');
    return clean(rows?.[0]?.config?.connectors?.email?.fromAddress||'',320);
  }catch{return '';}
}
async function sendRecruitmentEmail(to:string,subject:string,message:string){
  const resend=env('RESEND_API_KEY'),from=await recruitmentSenderAddress();
  if(!resend)throw new Error('Recruitment email delivery is not configured. Add RESEND_API_KEY to Supabase Edge Function Secrets.');
  if(!from)throw new Error('Recruitment email delivery is not configured. Set RECRUITMENT_FROM_EMAIL to a verified Resend sender address.');
  const payload:any={from,to:[to],subject,text:message};const replyTo=env('RECRUITMENT_REPLY_TO');if(replyTo)payload.reply_to=replyTo;
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json','User-Agent':'Assurance-Regent-Recruitment/6.3.23','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(payload)});
  const t=await r.text();let data:any={};try{data=t?JSON.parse(t):{};}catch{data={message:t};}
  if(!r.ok)throw new Error(data?.message||data?.error?.message||`Email provider rejected the message (${r.status}).`);
  return {provider:'resend',reference:String(data?.id||'')};
}

Deno.serve(async(req:any)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'POST is required.'},405);
  try{
    const body=await req.json().catch(()=>({})),action=clean(body?.action||'',60).toLowerCase();
    if(action==='list_vacancies'){
      try{await rpc('assurance_regent_recruitment_archive_expired_vacancies',{});}catch{}
      const state=await clientState(),rows=publicVacanciesFromState(state,clean(body?.company_id,160),clean(body?.vacancy_id,160));
      return json({vacancies:rows,generated_at:new Date().toISOString()});
    }
    if(action==='apply'){
      if(clean(body?.website,200))return json({ok:true,received:true});
      const companyId=clean(body?.company_id,160),vacancyId=clean(body?.vacancy_id,160),name=clean(body?.name,200),mail=email(body?.email),phone=clean(body?.phone,100),location=clean(body?.location,200),cover=clean(body?.cover_note,10000),qualification=clean(body?.qualification,600),skillsSummary=clean(body?.skills_summary,3000),experienceYears=Math.max(0,Math.min(60,Number(body?.experience_years||0)||0));
      if(!companyId||!vacancyId||!name||!mail)throw new Error('Name, email and vacancy are required.');if(!isEmail(mail))throw new Error('Enter a valid email address.');if(!cover)throw new Error('Write your cover letter before submitting.');if(!body?.resume_base64)throw new Error('Attach your CV / résumé before submitting.');
      if(body?.consent!==true)throw new Error('Consent is required before the application can be submitted.');
      try{await rpc('assurance_regent_recruitment_archive_expired_vacancies',{});}catch{}
      const state=await clientState(),vacancy=publicVacanciesFromState(state,companyId,vacancyId)[0];if(!vacancy)throw new Error('This vacancy is no longer open for external applications.');
      const fingerprint=await requestHash(req),recent=await select('assurance_regent_recruitment_applications',`vacancy_id=eq.${encodeURIComponent(vacancyId)}&email=eq.${encodeURIComponent(mail)}&applied_at=gte.${encodeURIComponent(new Date(Date.now()-10*60*1000).toISOString())}&select=id&limit=1`);
      if(recent?.length)throw new Error('An application from this email was received recently. Please wait before submitting again.');
      const burst=await select('assurance_regent_recruitment_applications',`request_hash=eq.${encodeURIComponent(fingerprint)}&applied_at=gte.${encodeURIComponent(new Date(Date.now()-60*60*1000).toISOString())}&select=id&limit=9`);if((burst||[]).length>=8)throw new Error('Too many applications were submitted from this connection. Please try again later.');
      const id=crypto.randomUUID();let resumePath='',resumeName='',resumeType='';
      if(body?.resume_base64){
        const bytes=decodeBase64(String(body.resume_base64||''),6*1024*1024,'CV');resumeName=safeFileName(body?.resume_name||'resume.pdf');resumeType=clean(body?.resume_type||'',160);const ext=resumeName.toLowerCase().split('.').pop()||'';if(!resumeType){if(ext==='pdf')resumeType='application/pdf';else if(ext==='doc')resumeType='application/msword';else if(ext==='docx')resumeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document';}
        const allowed=new Set(['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);if(!allowed.has(resumeType)||!['pdf','doc','docx'].includes(ext))throw new Error('CV must be PDF, DOC or DOCX.');
        resumePath=`${safeFileName(companyId)}/${safeFileName(vacancyId)}/${id}/cv/${resumeName}`;await uploadPrivate(resumePath,bytes,resumeType);
      }
      const rawAttachments=Array.isArray(body?.attachments)?body.attachments.slice(0,5):[];if(rawAttachments.length>4)throw new Error('Choose no more than 4 additional recruitment attachments.');let attachmentTotal=0;const attachments:any[]=[];
      for(let i=0;i<rawAttachments.length;i++){const a=rawAttachments[i]||{},name=safeFileName(a.name||`attachment-${i+1}`),type=clean(a.type||'application/octet-stream',180);if(!attachmentAllowed(name,type))throw new Error(`${name} is not an accepted recruitment attachment.`);const bytes=decodeBase64(String(a.base64||''),5*1024*1024,name);attachmentTotal+=bytes.length;if(attachmentTotal>8*1024*1024)throw new Error('Additional attachments must be 8 MB or smaller in total.');const path=`${safeFileName(companyId)}/${safeFileName(vacancyId)}/${id}/attachments/${i+1}-${name}`;await uploadPrivate(path,bytes,type);attachments.push({name,type,size:bytes.length,path});}
      await insert('assurance_regent_recruitment_applications',{id,company_id:companyId,vacancy_id:vacancyId,vacancy_title:vacancy.title,applicant_name:name,email:mail,phone,location,experience_years:experienceYears,qualification,skills_summary:skillsSummary,cover_note:cover,resume_path:resumePath,resume_name:resumeName,resume_type:resumeType,attachments,status:'NEW',source:'PUBLIC_CAREERS',request_hash:fingerprint,consent_at:new Date().toISOString()});
      await insert('assurance_regent_recruitment_notifications',{company_id:companyId,application_id:id,vacancy_id:vacancyId,kind:'NEW_APPLICATION',title:`New application: ${vacancy.title}`,detail:`${name} applied for ${vacancy.title}.`});
      return json({ok:true,application_id:id,vacancy_title:vacancy.title,message:'Application received successfully.'},201);
    }
    if(action==='interview_details'){
      const token=clean(body?.token,80);if(!/^[0-9a-f-]{36}$/i.test(token))throw new Error('Interview invitation is invalid.');
      const rows=await select('assurance_regent_recruitment_interviews',`candidate_token=eq.${encodeURIComponent(token)}&select=id,vacancy_title,candidate_name,scheduled_at,time_zone,meet_url,status&limit=1`),row=rows?.[0];
      if(!row||String(row.status)==='CANCELLED')throw new Error('This interview invitation is not active.');
      const meet=clean(row.meet_url||'',1000);return json({interview:{id:row.id,vacancy_title:row.vacancy_title,candidate_name:row.candidate_name,scheduled_at:row.scheduled_at,time_zone:row.time_zone,meet_url:/^https:\/\/meet\.google\.com\//i.test(meet)?meet:'',status:row.status}});
    }
    if(action==='hr_resume_url'){
      const bundle=await hrBundle(clean(body?.session_token,240)),app=applicantFromBundle(bundle,clean(body?.application_id,80));if(!app)throw new Error('Application not found or not permitted.');if(!app.resume_path)throw new Error('This application has no uploaded CV.');return json({url:await signedFile(app.resume_path,600),expires_in:600});
    }
    if(action==='hr_attachment_url'){
      const bundle=await hrBundle(clean(body?.session_token,240)),app=applicantFromBundle(bundle,clean(body?.application_id,80));if(!app)throw new Error('Application not found or not permitted.');const rows=Array.isArray(app.attachments)?app.attachments:[],idx=Math.max(0,Math.floor(Number(body?.attachment_index||0))),file=rows[idx];if(!file?.path)throw new Error('Recruitment attachment not found.');return json({url:await signedFile(String(file.path),600),name:file.name||`Attachment ${idx+1}`,expires_in:600});
    }
    if(action==='hr_rank_candidates'){
      const token=clean(body?.session_token,240),vacancyId=clean(body?.vacancy_id,160);if(!vacancyId)throw new Error('Select a vacancy for AI fit review.');const bundle=await hrBundle(token),apps=(bundle?.applications||[]).filter((a:any)=>String(a.vacancy_id)===vacancyId&&!['WITHDRAWN','REJECTED'].includes(String(a.status||'')));if(!apps.length)throw new Error('There are no eligible applications for this vacancy.');const state=await clientState(),v=rawVacancy(state,vacancyId);if(!v)throw new Error('Vacancy not found.');
      const criteria={title:clean(v.title,200),department:clean(v.department,160),experienceYears:Number(v.experienceYears||0),requirements:clean(v.publicRequirements,7000),responsibilities:clean(v.publicResponsibilities,7000),skills:clean(v.publicSkills,5000),education:clean(v.publicEducation,2500)};
      const candidates=apps.slice(0,80).map((a:any)=>({id:a.id,experience_years:Number(a.experience_years||0),qualification:clean(a.qualification,600),skills_summary:clean(a.skills_summary,3000),cover_letter:clean(a.cover_note,5000),documents:(Array.isArray(a.attachments)?a.attachments:[]).map((x:any)=>clean(x.name,120)),cv_submitted:Boolean(a.resume_path)}));
      const prompt=`You are Jivan's recruitment-analysis specialist in Assurance Regent. Perform an ADVISORY job-fit review for Human Resources. Compare only job-related qualifications supplied below. Do not infer or use age, sex, gender, race, ethnicity, religion, disability, health, family status, nationality, political views or any other protected/sensitive characteristic. Do not make the hiring decision. Missing information must lower certainty rather than be invented. Return ONLY JSON: {"results":[{"id":"uuid","score":0-100,"summary":"one concise evidence-based explanation"}]}. Sort from strongest documented fit to weakest.\nJOB CRITERIA:\n${JSON.stringify(criteria)}\nAPPLICATIONS (names/contact details intentionally excluded):\n${JSON.stringify(candidates)}`;
      const parsed=parseJsonObject(await openAi(prompt,3500)),results=Array.isArray(parsed?.results)?parsed.results:[];let rank=0;for(const r of results){const app=apps.find((a:any)=>String(a.id)===String(r.id));if(!app)continue;rank++;await patch('assurance_regent_recruitment_applications',`id=eq.${encodeURIComponent(app.id)}`,{ai_score:Math.max(0,Math.min(100,Number(r.score||0))),ai_rank:rank,ai_summary:clean(r.summary,1200),ai_assessed_at:new Date().toISOString(),ai_model:env('OPENAI_MODEL')||'gpt-5-mini'});}return json({ok:true,vacancy_id:vacancyId,reviewed:rank,advisory_only:true});
    }
    if(action==='hr_prepare_outreach'){
      const token=clean(body?.session_token,240),applicationId=clean(body?.application_id,80),bundle=await hrBundle(token),app=applicantFromBundle(bundle,applicationId);if(!app)throw new Error('Application not found or not permitted.');const interview=(bundle?.interviews||[]).find((i:any)=>String(i.application_id)===applicationId&&String(i.status)==='SCHEDULED'),interviewUrl=clean(body?.interview_url,1000);let subject=`Interview invitation — ${app.vacancy_title}`,message='';
      const facts={candidate_name:app.applicant_name,vacancy_title:app.vacancy_title,interview_time:interview?.scheduled_at||'',time_zone:interview?.time_zone||'',candidate_interview_page:interviewUrl};
      try{const prompt=`You are Zari assisting Human Resources in Assurance Regent. Draft a concise, professional candidate message. The candidate has been shortlisted. If interview_time is present, clearly invite them to that interview and include the candidate_interview_page. Do not promise employment or invent details. Return ONLY JSON {"subject":"...","message":"..."}. Facts: ${JSON.stringify(facts)}`;const parsed=parseJsonObject(await openAi(prompt,900));subject=clean(parsed?.subject||subject,240);message=clean(parsed?.message||'',6000);}catch{}
      if(!message){message=`Dear ${app.applicant_name},\n\nThank you for applying for the ${app.vacancy_title} position. We are pleased to let you know that Human Resources has shortlisted your application.${interview?`\n\nYou are invited to a virtual interview on ${new Date(interview.scheduled_at).toUTCString()} (${interview.time_zone||'local time'}).${interviewUrl?`\nInterview access: ${interviewUrl}`:''}`:'\n\nHuman Resources will contact you with the next interview arrangements.'}\n\nKind regards,\nHuman Resources`;}
      return json({ok:true,application_id:app.id,email:app.email,phone:app.phone,subject,message,interview_scheduled:Boolean(interview)});
    }
    if(action==='hr_send_outreach'){
      const token=clean(body?.session_token,240),applicationId=clean(body?.application_id,80),channel=clean(body?.channel,30).toLowerCase(),message=clean(body?.message,6000),subject=clean(body?.subject,240)||'Recruitment update',bundle=await hrBundle(token),app=applicantFromBundle(bundle,applicationId);if(!app)throw new Error('Application not found or not permitted.');if(!message)throw new Error('Review the prepared message before sending.');if(!['email','whatsapp'].includes(channel))throw new Error('Choose email or WhatsApp.');let sent=false,url='',provider='';
      if(channel==='email'){
        if(!isEmail(app.email))throw new Error('The applicant does not have a valid email address.');const delivery=await sendRecruitmentEmail(app.email,subject,message);sent=true;provider=delivery.provider;
      }else{
        const phone=normalizePhone(app.phone);if(!phone)throw new Error('The applicant did not provide a usable WhatsApp number.');const access=env('WHATSAPP_ACCESS_TOKEN'),phoneId=env('WHATSAPP_PHONE_NUMBER_ID'),graphVersion=env('WHATSAPP_GRAPH_VERSION');if(access&&phoneId&&graphVersion){try{const r=await fetch(`https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneId)}/messages`,{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phone,type:'text',text:{preview_url:true,body:message}})});const t=await r.text();if(!r.ok)throw new Error(t.slice(0,500));sent=true;provider='whatsapp-cloud';}catch(err:any){url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;provider='whatsapp-link-fallback';}}
        else{url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;provider='whatsapp-link';}
      }
      await recordOutreach({company_id:app.company_id,application_id:app.id,channel,recipient:channel==='email'?app.email:app.phone,subject,message,delivery_status:sent?'SENT':'PREPARED',provider,created_by:'HR'});return json({ok:true,sent,url,provider});
    }
    return json({error:'Unknown recruitment action.'},400);
  }catch(err:any){const message=String(err?.message||err||'Recruitment request failed.');return json({error:message},/not configured/i.test(message)?503:400);}
});