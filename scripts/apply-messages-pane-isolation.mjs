import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public');
const targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));

const marker='v6.3.29 — internal communications are Messages-only';
const helper=`
  /* ${marker}. */
  function isInternalCommunicationItem(row){
    const kind=String(row?.kind||'').trim().toLowerCase(),source=String(row?.metadata?.source||row?.source||'').trim().toUpperCase();
    return kind==='message'||kind==='advisor'||kind==='ai_advisory'||kind==='ai_reply'||kind==='ai_user'||source==='AI_OPERATIONAL_ADVISORY'||source==='AI_INBOX_THREAD'||source==='JIVAN_PROACTIVE'||source==='INTERNAL_MESSAGE';
  }
  function internalMessageAttachmentIds(){
    const ids=new Set();for(const row of (state.internalInbox?.messages||[])){for(const value of [row?.attachmentFileId,row?.storageFileId,row?.fileId])if(value)ids.add(String(value));}return ids;
  }
  function isInternalMessageDocument(row){
    const ids=internalMessageAttachmentIds(),meta=row?.metadata||{},fingerprint=[row?.category,row?.entityType,row?.entity_type,row?.source,meta?.category,meta?.entityType,meta?.entity_type,meta?.source].filter(Boolean).join('|').toLowerCase();
    if(/internal[-_ ]message|private[-_ ]message|message[-_ ]attachment/.test(fingerprint))return true;
    return [row?.id,row?.fileId,row?.storageFileId,row?.storage_file_id].some(value=>value&&ids.has(String(value)));
  }
  function isInternalMessageReview(row){
    const meta=row?.metadata||{},fingerprint=[row?.kind,row?.category,row?.entityType,row?.entity_type,row?.source,meta?.category,meta?.entityType,meta?.entity_type,meta?.source].filter(Boolean).join('|').toLowerCase();
    if(/internal[-_ ]message|private[-_ ]message|message[-_ ]attachment/.test(fingerprint))return true;
    const ids=internalMessageAttachmentIds();return [row?.documentId,row?.document_id,row?.fileId,row?.storageFileId,row?.sourceId,row?.source_id].some(value=>value&&ids.has(String(value)));
  }
`;

for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  if(!s.includes(marker)){
    const anchor='  function renderNotificationsPane(){';
    if(!s.includes(anchor))throw new Error(`Notifications renderer anchor missing in ${basename(file)}.`);
    s=s.replace(anchor,helper+'\n'+anchor);
  }

  s=s.replace("const c=state.control||defaultLocalControl(),rows=(c.notifications||[]).filter(x=>x.kind!=='message'),counts={review:0,task:0,message:0,advisor:0,account_approval:0,leave_approval:0,recruitment_application:0};", "const c=state.control||defaultLocalControl(),rows=(c.notifications||[]).filter(x=>!isInternalCommunicationItem(x)),counts={review:0,task:0,account_approval:0,leave_approval:0,recruitment_application:0};");
  s=s.replace("$('notificationSummary').innerHTML=[['Applications',counts.recruitment_application],['Account approvals',counts.account_approval],['Leave approvals',counts.leave_approval],['Approvals',counts.review],['Messages',counts.message],['AI advice',counts.advisor]].map", "$('notificationSummary').innerHTML=[['Applications',counts.recruitment_application],['Account approvals',counts.account_approval],['Leave approvals',counts.leave_approval],['Approvals',counts.review]].map");
  s=s.replace("emptyControl('You are up to date','New account requests, pending approvals, tasks, unread messages and useful AI advice will appear here automatically.')", "emptyControl('You are up to date','New account requests, pending approvals and assigned tasks will appear here automatically.')");

  s=s.replace("const rows=(state.control?.documents||[]).filter(d=>state.documentFilter==='ALL'||d.status===state.documentFilter),u=controlUser(),perm=controlPermissions();", "const rows=(state.control?.documents||[]).filter(d=>!isInternalMessageDocument(d)).filter(d=>state.documentFilter==='ALL'||d.status===state.documentFilter),u=controlUser(),perm=controlPermissions();");
  s=s.replace("const rows=c.reviews||[];", "const rows=(c.reviews||[]).filter(r=>!isInternalMessageReview(r));");

  s=s.replace("n=u?(c.notifications||[]).filter(x=>['advisor','task','review','account_approval','leave_approval','recruitment_application'].includes(String(x.kind||''))).length:0,m=u?Number(state.internalInbox?.unread||0):0,d=u?(c.documents||[]).filter(x=>x.status==='PENDING_REVIEW').length:0,r=u?(c.reviews||[]).length:0;", "n=u?(c.notifications||[]).filter(x=>!isInternalCommunicationItem(x)&&['task','review','account_approval','leave_approval','recruitment_application'].includes(String(x.kind||''))).length:0,m=u?Number(state.internalInbox?.unread||0):0,d=u?(c.documents||[]).filter(x=>!isInternalMessageDocument(x)&&x.status==='PENDING_REVIEW').length:0,r=u?(c.reviews||[]).filter(x=>!isInternalMessageReview(x)).length:0;");

  s=s.replace("notifications:['Notifications','Pending tasks, unread messages and assigned approvals.']", "notifications:['Notifications','Pending tasks and assigned approvals.']");

  if(!s.includes("rows=(c.notifications||[]).filter(x=>!isInternalCommunicationItem(x))"))throw new Error(`Notifications are not isolated from Messages in ${basename(file)}.`);
  if(!s.includes("filter(d=>!isInternalMessageDocument(d))"))throw new Error(`Documents are not isolated from message attachments in ${basename(file)}.`);
  if(!s.includes("filter(r=>!isInternalMessageReview(r))"))throw new Error(`Reviews are not isolated from message attachments in ${basename(file)}.`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[messages-only] ${basename(file)} notifications=isolated documents=isolated reviews=isolated settings-profile=non-message`);
}
