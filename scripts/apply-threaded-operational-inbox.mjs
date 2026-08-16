import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

const cssLink='  <link rel="stylesheet" href="./work-inbox-threaded.css?v=6.3.28" />\n';
const threadDialog=`
  <dialog class="inbox-thread-dialog" id="inboxThreadDialog" aria-labelledby="inboxThreadTitle">
    <div class="inbox-thread-shell">
      <div class="modal-head inbox-thread-head">
        <div class="inbox-thread-identity"><span id="inboxThreadAvatar"></span><div><b id="inboxThreadTitle">Conversation</b><small id="inboxThreadSubtitle">Internal Inbox</small></div></div>
        <div class="inbox-thread-head-actions"><button type="button" class="btn ghost small" id="inboxThreadClear">Clear</button><button type="button" class="icon-btn" id="inboxThreadClose" aria-label="Close conversation">×</button></div>
      </div>
      <div class="inbox-thread-history" id="inboxThreadHistory"></div>
      <form class="inbox-thread-reply" id="inboxThreadReplyForm">
        <textarea id="inboxThreadReply" rows="3" maxlength="6000" required placeholder="Write a reply…"></textarea>
        <div class="inbox-thread-reply-actions"><label class="inbox-attachment-picker" id="inboxThreadAttachmentPicker">📎 Attach document<input id="inboxThreadAttachmentFile" type="file" hidden /></label><span class="inbox-attachment-name" id="inboxThreadAttachmentName"></span><button class="btn primary small" type="submit">Send</button></div>
      </form>
    </div>
  </dialog>
`;

function patchHtml(file){
  let s=readFileSync(file,'utf8'),before=s;
  if(!s.includes('work-inbox-threaded.css?v=6.3.28'))s=s.replace('</head>',`${cssLink}</head>`);
  s=s.replace('Private company messages, attachments and Jivan reminders.','Private staff conversations and role-scoped operational AI advisories.');
  s=s.replace('data-inbox-filter="ai">Jivan</button>','data-inbox-filter="ai">AI advisories</button>');
  if(!s.includes('id="inboxThreadDialog"'))s=s.replace('</body>',`${threadDialog}\n</body>`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[threaded-inbox] ${basename(file)} thread-dialog=enabled operational-ai-copy=enabled`);
}

const runtime=`
  /* v6.3.28 — threaded staff conversations + operational AI Inbox advisories only. */
  let lastOperationalInboxAdvisoryRefresh=0;
  function inboxIsAiMessage(row){
    const source=String(row?.metadata?.source||''),kind=String(row?.kind||'').toUpperCase();
    return ['AI_OPERATIONAL_ADVISORY','AI_INBOX_THREAD'].includes(source)||kind==='AI_ADVISORY'||kind==='AI_REPLY'||kind==='AI_USER';
  }
  function inboxThreadGroups(){
    const map=new Map();for(const row of (state.internalInbox?.messages||[])){const id=String(row.threadId||row.id||'');if(!id)continue;if(!map.has(id))map.set(id,[]);map.get(id).push(row);}
    return [...map.entries()].map(([threadId,messages])=>{messages.sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));const latest=messages[messages.length-1],ai=messages.some(inboxIsAiMessage),unread=messages.filter(x=>x.direction==='IN'&&!x.read).length;return {threadId,messages,latest,ai,unread};}).sort((a,b)=>new Date(b.latest?.createdAt||0)-new Date(a.latest?.createdAt||0));
  }
  function inboxThreadPeer(group){
    const me=String(controlUser()?.id||previewSessionUserId||''),rows=group?.messages||[];for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(String(r.senderId||'')===me&&r.recipientId&&String(r.recipientId).toUpperCase()!=='JIVAN')return {id:r.recipientId,name:r.recipientName||r.recipientId,photo:r.recipientPhoto||'',position:r.recipientPosition||''};if(String(r.recipientId||'')===me&&r.senderId&&String(r.senderId).toUpperCase()!=='JIVAN')return {id:r.senderId,name:r.senderName||r.senderId,photo:r.senderPhoto||'',position:r.senderPosition||''};}
    return null;
  }
  function inboxThreadAvatar(group){
    if(group?.ai)return inboxAvatar({kind:'AI_ADVISORY',senderId:'JIVAN'});const peer=inboxThreadPeer(group);if(!peer)return '<span class="inbox-avatar">?</span>';const photo=safeProfilePhoto(peer.photo||'');return photo?\`<span class="inbox-avatar"><img src="\${esc(photo)}" alt="\${esc(peer.name||'User')}" /></span>\`:\`<span class="inbox-avatar">\${esc(companyInitials(peer.name||'User'))}</span>\`;
  }
  function inboxTopicLabel(topic=''){return String(topic||'Operational advisory').replace(/_/g,' ').toLowerCase().replace(/(^|\\s)\\S/g,m=>m.toUpperCase());}
  function renderInternalInbox(){
    const host=$('internalInboxList');if(!host)return;populateInboxRecipients();const filter=state.internalInboxFilter||'all',groups=inboxThreadGroups().filter(g=>filter==='unread'?g.unread>0:filter==='ai'?g.ai:true);document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.classList.toggle('active',b.dataset.inboxFilter===filter));
    host.innerHTML=groups.length?groups.map(g=>{const x=g.latest||{},peer=inboxThreadPeer(g),title=g.ai?(x.threadTitle||'Jivan operational advisory'):(peer?.name||'Internal conversation'),meta=g.ai?\`Jivan · \${inboxTopicLabel(x.topic||'Operational advisory')}\`:(peer?.position||'Private staff conversation'),priority=g.ai?String(x.metadata?.priority||'').toUpperCase():'',preview=String(x.content||'').slice(0,260),badge=g.unread?\`<span class="inbox-thread-unread">\${g.unread>99?'99+':g.unread}</span>\`:'',priorityChip=priority?\`<span class="inbox-priority \${priority.toLowerCase()}">\${esc(priority)}</span>\`:'';return \`<article class="inbox-message inbox-thread-card \${g.unread?'unread':''} \${g.ai?'ai-message':''}" role="button" tabindex="0" data-inbox-thread="\${esc(g.threadId)}"><div class="inbox-message-avatar">\${inboxThreadAvatar(g)}</div><div class="inbox-message-main"><div class="inbox-message-head"><div><b>\${esc(title)}</b><small>\${esc(meta)}</small></div><time>\${formatDateTime(x.createdAt)}</time></div><p>\${esc(preview)}\${String(x.content||'').length>260?'…':''}</p><div class="inbox-message-actions">\${priorityChip}\${badge}<span class="inbox-open-thread">Open conversation</span><button type="button" class="text-link danger-link" data-inbox-clear-thread="\${esc(g.threadId)}">Clear</button></div></div></article>\`;}).join(''):'<div class="control-empty"><b>No conversations here</b><span>Private staff conversations and meaningful operational AI advisories will appear here. Ordinary Jivan chat stays in the Jivan chatbox.</span></div>';
    host.querySelectorAll('[data-inbox-thread]').forEach(card=>{card.addEventListener('click',e=>{if(e.target.closest('[data-inbox-clear-thread]'))return;openInboxThread(card.dataset.inboxThread);});card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();openInboxThread(card.dataset.inboxThread);}});});
    host.querySelectorAll('[data-inbox-clear-thread]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();clearInboxThread(b.dataset.inboxClearThread);}));
  }
  async function refreshOperationalInboxAdvisories(force=false){
    if(!browserSessionToken)return;const now=Date.now();if(!force&&now-lastOperationalInboxAdvisoryRefresh<10*60*1000)return;lastOperationalInboxAdvisoryRefresh=now;
    try{await supabaseFunction('jivan-inbox-ai',{mode:'advisories',force:Boolean(force)});await loadInternalInbox(true);renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();}catch(err){console.warn('Operational Inbox advisories unavailable',err);}
  }
  async function loadInboxThread(threadId){return supabaseRpc('assurance_regent_browser_message_thread',{p_token:browserSessionToken,p_thread_id:String(threadId||'')},{bypassCache:true});}
  function renderInboxThread(thread=state.activeInboxThread){
    if(!thread)return;const rows=Array.isArray(thread.messages)?thread.messages:[],ai=Boolean(thread.isAi),me=String(controlUser()?.id||previewSessionUserId||''),group={messages:rows,ai},peer=inboxThreadPeer(group),title=ai?(thread.title||rows.find(inboxIsAiMessage)?.threadTitle||'Jivan operational advisory'):(peer?.name||'Internal conversation'),subtitle=ai?\`Jivan · Operational advisory · \${inboxTopicLabel(thread.topic||rows.find(inboxIsAiMessage)?.topic||'Operational advisory')}\`:(peer?.position||'Private staff conversation');
    if($('inboxThreadAvatar'))$('inboxThreadAvatar').innerHTML=inboxThreadAvatar(group);if($('inboxThreadTitle'))$('inboxThreadTitle').textContent=title;if($('inboxThreadSubtitle'))$('inboxThreadSubtitle').textContent=subtitle;
    const host=$('inboxThreadHistory');if(host){host.innerHTML=rows.map(r=>{const mine=String(r.senderId||'')===me,fromAi=String(r.senderId||'').toUpperCase()==='JIVAN',name=mine?'You':fromAi?'Jivan':(r.senderName||'User'),attachment=r.attachmentFileId?\`<button type="button" class="inbox-attachment" data-thread-attachment="\${esc(r.attachmentFileId)}" data-thread-attachment-name="\${encodeURIComponent(r.attachmentName||'attachment')}">📎 \${esc(r.attachmentName||'Attachment')}</button>\`:'';return \`<div class="inbox-thread-row \${mine?'mine':fromAi?'ai':''}"><div class="inbox-thread-bubble"><div class="inbox-thread-bubble-head"><b>\${esc(name)}</b><time>\${formatDateTime(r.createdAt)}</time></div><p>\${esc(r.content||'')}</p>\${attachment}</div></div>\`;}).join('');host.querySelectorAll('[data-thread-attachment]').forEach(b=>b.addEventListener('click',()=>openPersistentFile(b.dataset.threadAttachment,decodeURIComponent(b.dataset.threadAttachmentName||'attachment')).catch(err=>toast(err.message))));host.scrollTop=host.scrollHeight;}
    if($('inboxThreadReply'))$('inboxThreadReply').placeholder=ai?'Reply to Jivan about this operational advisory…':\`Message \${peer?.name||'this user'}…\`;if($('inboxThreadAttachmentPicker'))$('inboxThreadAttachmentPicker').hidden=ai;if(ai&&$('inboxThreadAttachmentFile'))$('inboxThreadAttachmentFile').value='';if(ai&&$('inboxThreadAttachmentName'))$('inboxThreadAttachmentName').textContent='';
  }
  async function openInboxThread(threadId){
    if(!threadId)return;try{await supabaseRpc('assurance_regent_browser_message_thread_mark_read',{p_token:browserSessionToken,p_thread_id:threadId},{bypassCache:true}).catch(()=>{});const thread=await loadInboxThread(threadId);state.activeInboxThread=thread;renderInboxThread(thread);if($('inboxThreadDialog')&&!$('inboxThreadDialog').open)$('inboxThreadDialog').showModal();await loadInternalInbox(true);renderInternalInbox();renderControlDock();}catch(err){toast(err.message||'Could not open this conversation.');}
  }
  function closeInboxThread(){if($('inboxThreadDialog')?.open)$('inboxThreadDialog').close();state.activeInboxThread=null;}
  async function clearInboxThread(threadId){
    if(!threadId)return;if(!confirm('Clear this conversation from your Inbox? This hides the current history for your account only.'))return;try{await supabaseRpc('assurance_regent_browser_message_clear_thread',{p_token:browserSessionToken,p_thread_id:threadId});if(state.activeInboxThread?.threadId===threadId)closeInboxThread();await loadInternalInbox(true);renderInternalInbox();renderControlDock();toast('Conversation cleared from your Inbox.');}catch(err){toast(err.message||'Could not clear this conversation.');}
  }
  async function sendInboxThreadReply(e){
    e?.preventDefault?.();const thread=state.activeInboxThread,content=$('inboxThreadReply')?.value.trim()||'',file=$('inboxThreadAttachmentFile')?.files?.[0],submit=$('inboxThreadReplyForm')?.querySelector('button[type="submit"]');if(!thread?.threadId)return toast('Open a conversation first.');if(!content)return toast('Write a reply before sending.');if(submit){submit.disabled=true;submit.textContent='Sending…';}
    try{if(thread.isAi){await supabaseFunction('jivan-inbox-ai',{mode:'reply',thread_id:thread.threadId,message:content});}else{const group={messages:thread.messages||[],ai:false},peer=inboxThreadPeer(group);if(!peer?.id)throw new Error('The other conversation participant could not be identified.');let attachment=null;if(file)attachment=await uploadPersistentFile(file,{category:'internal-message',entityType:'internal-message',entityId:thread.threadId,metadata:{recipientId:peer.id,threadId:thread.threadId}});await supabaseRpc('assurance_regent_browser_message_send',{p_token:browserSessionToken,p_recipient_id:peer.id,p_content:content,p_attachment_file_id:attachment?.fileId||null,p_thread_id:thread.threadId});}if($('inboxThreadReply'))$('inboxThreadReply').value='';if($('inboxThreadAttachmentFile'))$('inboxThreadAttachmentFile').value='';if($('inboxThreadAttachmentName'))$('inboxThreadAttachmentName').textContent='';const fresh=await loadInboxThread(thread.threadId);state.activeInboxThread=fresh;renderInboxThread(fresh);await loadInternalInbox(true);renderInternalInbox();renderControlDock();}catch(err){toast(err.message||'Could not send this reply.');}finally{if(submit){submit.disabled=false;submit.textContent='Send';}}
  }
`;

const newSend=`  async function sendInternalInboxMessage(e){
    e?.preventDefault?.();const recipient=$('inboxRecipientSelect')?.value||'',content=$('inboxMessageContent')?.value.trim()||'',file=$('inboxAttachmentFile')?.files?.[0];if(!recipient)return toast('Select a recipient.');if(!content)return toast('Write a message before sending.');const submit=$('internalMessageForm')?.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Sending…';}
    try{let attachment=null;if(file)attachment=await uploadPersistentFile(file,{category:'internal-message',entityType:'internal-message',entityId:crypto.randomUUID(),metadata:{recipientId:recipient}});const sent=await supabaseRpc('assurance_regent_browser_message_send',{p_token:browserSessionToken,p_recipient_id:recipient,p_content:content,p_attachment_file_id:attachment?.fileId||null,p_thread_id:null});if($('inboxMessageContent'))$('inboxMessageContent').value='';if($('inboxAttachmentFile'))$('inboxAttachmentFile').value='';if($('inboxAttachmentName'))$('inboxAttachmentName').textContent='';if($('internalMessageForm'))$('internalMessageForm').hidden=true;await loadInternalInbox(true);renderInternalInbox();renderControlDock();toast('Private internal message sent.');if(sent?.threadId)await openInboxThread(sent.threadId);}
    catch(err){toast(err.message||'Could not send the internal message.');}finally{if(submit){submit.disabled=false;submit.textContent='Send';}}
  }`;

function patchApp(file){
  let s=readFileSync(file,'utf8'),before=s;
  const renderPattern=/  function renderInternalInbox\(\)\{[\s\S]*?\n  async function draftInternalInboxWithJivan\(\)\{/u;
  if(!s.includes('v6.3.28 — threaded staff conversations + operational AI Inbox advisories only.')){
    if(!renderPattern.test(s))throw new Error(`Inbox renderer anchor missing in ${basename(file)}.`);
    s=s.replace(renderPattern,`${runtime}\n  async function draftInternalInboxWithJivan(){`);
  }
  const sendPattern=/  async function sendInternalInboxMessage\(e\)\{[\s\S]*?\n  async function markInternalInboxRead\(id\)\{/u;
  if(sendPattern.test(s))s=s.replace(sendPattern,`${newSend}\n  async function markInternalInboxRead(id){`);
  const queuePattern=/  function queueAiInboxMessage\(text,label='Jivan'\)\{[\s\S]*?\n  \}\n  function startInternalInboxPolling\(\)\{[\s\S]*?\n  \}/u;
  if(queuePattern.test(s))s=s.replace(queuePattern,`  function queueAiInboxMessage(){ return; }\n  function startInternalInboxPolling(){if(internalInboxPoller)clearInterval(internalInboxPoller);refreshOperationalInboxAdvisories(false).catch(()=>{});internalInboxPoller=setInterval(()=>{if(!browserSessionToken||document.hidden)return;loadInternalInbox(true).then(()=>{renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();return refreshOperationalInboxAdvisories(false);}).catch(()=>{});},15000);}`);
  s=s.replace("showMessage:(text,label='Jivan notification')=>{const value=String(text||'');addMessage('assistant',value,false,label);queueAiInboxMessage(value,label);},","showMessage:(text,label='Jivan notification')=>addMessage('assistant',String(text||''),false,label),");
  s=s.replace("messages:['Messages','Private internal messages, attachments and Jivan reminders.']","messages:['Messages','Private staff conversations and operational AI advisories.']");
  s=s.replace("if(panel==='messages'){renderInternalInbox();loadInternalInbox(true).then(()=>{renderInternalInbox();renderControlDock();}).catch(()=>{});}","if(panel==='messages'){renderInternalInbox();loadInternalInbox(true).then(()=>{renderInternalInbox();renderControlDock();return refreshOperationalInboxAdvisories(false);}).catch(()=>{});}");
  const bind="$('inboxFilterTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-inbox-filter]');if(!b)return;state.internalInboxFilter=b.dataset.inboxFilter;renderInternalInbox();});startInternalInboxPolling();";
  if(s.includes(bind)&&!s.includes("$('inboxThreadReplyForm')?.addEventListener('submit',sendInboxThreadReply);"))s=s.replace(bind,"$('inboxFilterTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-inbox-filter]');if(!b)return;state.internalInboxFilter=b.dataset.inboxFilter;renderInternalInbox();});$('inboxThreadReplyForm')?.addEventListener('submit',sendInboxThreadReply);$('inboxThreadClose')?.addEventListener('click',closeInboxThread);$('inboxThreadClear')?.addEventListener('click',()=>clearInboxThread(state.activeInboxThread?.threadId||''));$('inboxThreadAttachmentFile')?.addEventListener('change',()=>{if($('inboxThreadAttachmentName'))$('inboxThreadAttachmentName').textContent=$('inboxThreadAttachmentFile')?.files?.[0]?.name||'';});startInternalInboxPolling();");
  if(s.includes('assurance_regent_browser_message_ai_self'))throw new Error(`Legacy generic Jivan-to-Inbox RPC remains in ${basename(file)}.`);
  if(s.includes('queueAiInboxMessage(value,label)'))throw new Error(`Ordinary Jivan showMessage still routes into the Inbox in ${basename(file)}.`);
  for(const token of ['assurance_regent_browser_message_thread','assurance_regent_browser_message_clear_thread',"supabaseFunction('jivan-inbox-ai'",'sendInboxThreadReply','refreshOperationalInboxAdvisories'])if(!s.includes(token))throw new Error(`Threaded operational Inbox behavior missing ${token} in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[threaded-inbox] ${basename(file)} threaded-history=enabled ordinary-jivan-chat=isolated operational-advisories=enabled`);
}

for(const f of htmlTargets)patchHtml(f);
for(const f of appTargets.filter(existsSync))patchApp(f);
