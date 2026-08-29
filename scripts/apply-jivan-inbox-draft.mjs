import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  if(!s.includes('id="inboxJivanDraft"')){
    const anchor='<button class="btn primary small" type="submit">Send</button>';
    if(!s.includes(anchor))throw new Error(`Inbox Send button anchor missing in ${basename(file)}.`);
    s=s.replace(anchor,'<button class="btn secondary small" id="inboxJivanDraft" type="button">✦ Jivan draft</button>'+anchor);
  }
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[jivan-inbox-draft] ${basename(file)} human-approval-send=enabled`);
}

const helper=`
  /* v6.3.27 — Jivan Inbox drafting is draft-only; Send remains a human approval control. */
  async function draftInternalInboxWithJivan(){
    const recipient=$('inboxRecipientSelect')?.value||'',instruction=$('inboxMessageContent')?.value.trim()||'',btn=$('inboxJivanDraft');
    if(!recipient)return toast('Select the message recipient first.');
    if(!instruction)return toast('Write a rough message or reminder first, then ask Jivan to draft it.');
    if(btn){btn.disabled=true;btn.textContent='✦ Drafting…';}
    try{
      const result=await supabaseFunction('jivan-inbox-draft',{recipient_id:recipient,instruction});
      if(!result?.draft)throw new Error('Jivan did not return a message draft.');
      if($('inboxMessageContent'))$('inboxMessageContent').value=String(result.draft).slice(0,6000);
      toast('Jivan draft ready. Review it, then press Send to approve delivery.');
    }catch(err){toast(err.message||'Jivan could not prepare the internal message draft.');}
    finally{if(btn){btn.disabled=false;btn.textContent='✦ Jivan draft';}}
  }
`;

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s;
  if(!s.includes('async function draftInternalInboxWithJivan()')){
    const anchor='  async function sendInternalInboxMessage(e){';
    if(!s.includes(anchor))throw new Error(`Internal Inbox send handler anchor missing in ${basename(file)}.`);
    s=s.replace(anchor,helper+'\n'+anchor);
  }
  const bind="$('inboxComposeToggle')?.addEventListener('click',()=>{const f=$('internalMessageForm');if(f)f.hidden=!f.hidden;});";
  if(!s.includes("$('inboxJivanDraft')?.addEventListener('click',draftInternalInboxWithJivan);")){
    if(!s.includes(bind))throw new Error(`Inbox composer binding anchor missing in ${basename(file)}.`);
    s=s.replace(bind,bind+"$('inboxJivanDraft')?.addEventListener('click',draftInternalInboxWithJivan);");
  }
  if(!s.includes("supabaseFunction('jivan-inbox-draft'"))throw new Error(`Jivan Inbox drafting function call missing in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[jivan-inbox-draft] ${basename(file)} draft-only-ai=enabled send=human-approved`);
}
for(const f of htmlTargets)patchHtml(f);
for(const f of appTargets.filter(existsSync))patchApp(f);
