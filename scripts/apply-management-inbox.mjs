import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const htmlTargets = [resolve(root, 'index.html'), resolve(publicDir, 'index.html')].filter(existsSync);
const appTargets = [resolve(root, 'app.js')];
const agentTargets = [resolve(root, 'recovery-agent-v5.js')];
if (existsSync(publicDir)) {
  for (const name of readdirSync(publicDir)) {
    if (/^app(?:\.|-).*\.js$/iu.test(name)) appTargets.push(join(publicDir, name));
    if (/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name)) agentTargets.push(join(publicDir, name));
  }
}

const marker = 'v6.3.27 — management WAC analytics + private internal inbox';
const cssLink = '  <link rel="stylesheet" href="./work-inbox.css?v=6.3.27" />\n';

const messageDockButton = `            <button type="button" class="dock-button" data-control-panel="messages" aria-label="Messages" title="Messages">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 4zM8 9h8M8 12h6"/></svg><span class="dock-label">Messages</span><b class="dock-badge" id="inboxBadge" hidden>0</b>
            </button>
`;

const inboxPane = `    <div class="control-pane inbox-control-pane" id="controlPaneMessages" data-control-pane="messages" hidden>
      <div class="inbox-toolbar"><div><b>Internal inbox</b><small>Private company messages, attachments and Jivan reminders.</small></div><button type="button" class="btn primary small" id="inboxComposeToggle">+ New message</button></div>
      <form id="internalMessageForm" class="inbox-composer" hidden>
        <div class="inbox-recipient-row"><label>Find recipient<input id="inboxRecipientSearch" type="search" autocomplete="off" placeholder="Search name, role or department" /></label><label>Recipient<select id="inboxRecipientSelect" required><option value="">Select user</option></select></label></div>
        <label>Message<textarea id="inboxMessageContent" rows="3" maxlength="6000" required placeholder="Write a private internal message…"></textarea></label>
        <div class="inbox-compose-actions"><label class="inbox-attachment-picker">📎 Attach document<input id="inboxAttachmentFile" type="file" hidden /></label><span id="inboxAttachmentName" class="inbox-attachment-name"></span><button class="btn primary small" type="submit">Send</button></div>
      </form>
      <div class="inbox-filter-tabs" id="inboxFilterTabs"><button type="button" class="active" data-inbox-filter="all">All</button><button type="button" data-inbox-filter="unread">Unread</button><button type="button" data-inbox-filter="ai">Jivan</button></div>
      <div class="inbox-list" id="internalInboxList"></div>
    </div>
`;

const managementAnalytics = `          <section class="wac-management-dashboard" id="wacManagementAnalytics" hidden aria-label="Work Activity management analytics">
            <div class="dashboard-section-heading"><h3>Work Activity management analytics</h3><span>Management-only workforce performance and attendance evidence</span></div>
            <div class="kpi-grid compact" id="mtsKpis"></div>
            <div class="chart-grid mts-analytics-grid">
              <section class="panel chart-panel"><div class="panel-head"><div><span class="section-kicker">Top workers</span><h3>Completion + normalized hours</h3></div><span class="formula-mini">70% completion · 30% hours</span></div><canvas id="mtsTopWorkersChart" height="280"></canvas></section>
              <section class="panel"><div class="panel-head"><div><span class="section-kicker">Daily analytics</span><h3>Earliest clock-in / latest clock-out</h3></div><div class="daily-nav"><button class="icon-btn" id="mtsPrevDay">←</button><button class="icon-btn" id="mtsNextDay">→</button></div></div><div id="mtsDailyAnalytics" class="daily-evidence-card"></div></section>
              <section class="panel chart-panel"><div class="panel-head"><div><span class="section-kicker">Department performance</span><h3>Operational performance index</h3></div></div><canvas id="mtsDepartmentChart" height="280"></canvas></section>
              <section class="panel chart-panel"><div class="panel-head"><div><span class="section-kicker">Project performance</span><h3>Hours + completion by project</h3></div></div><canvas id="mtsProjectPerformanceChart" height="280"></canvas></section>
            </div>
            <div class="three-col mts-insight-grid">
              <section class="panel"><span class="section-kicker">Employee of the month</span><div id="mtsEmployeeMonth" class="winner-card"><span>☆</span><b>No completed sessions yet</b><small>Performance is management information only.</small></div></section>
              <section class="panel"><span class="section-kicker">Jobs analytics</span><h3>Task completion by project</h3><div id="mtsJobsList" class="analytics-list-modern"></div></section>
              <section class="panel"><span class="section-kicker">Overtime detection</span><h3>More than 8 hours/day</h3><div id="mtsOvertimeList" class="analytics-list-modern"></div></section>
            </div>
          </section>

`;

function patchHtml(file) {
  let source = readFileSync(file, 'utf8');
  const original = source;
  if (!source.includes('work-inbox.css?v=6.3.27')) source = source.replace('</head>', `${cssLink}</head>`);
  if (!source.includes('data-control-panel="messages"')) {
    const anchor = '            <button type="button" class="dock-button" data-control-panel="documents"';
    if (!source.includes(anchor)) throw new Error(`Documents dock anchor missing in ${basename(file)}.`);
    source = source.replace(anchor, `${messageDockButton}${anchor}`);
  }
  if (!source.includes('id="controlPaneMessages"')) {
    const anchor = '    <div class="control-pane" id="controlPaneDocuments" data-control-pane="documents" hidden>';
    if (!source.includes(anchor)) throw new Error(`Documents pane anchor missing in ${basename(file)}.`);
    source = source.replace(anchor, `${inboxPane}${anchor}`);
  }
  if (!source.includes('id="wacManagementAnalytics"')) {
    const dashboardAnchor = '          <div class="dashboard-section-heading analytics-heading"><h3>Recovery analytics</h3>';
    if (!source.includes(dashboardAnchor)) throw new Error(`Dashboard analytics insertion point missing in ${basename(file)}.`);
    source = source.replace(dashboardAnchor, `${managementAnalytics}${dashboardAnchor}`);
  }
  source = source.replace(/\n\s*<div class="kpi-grid compact" id="mtsKpis"><\/div>\s*\n(?=\s*<section class="panel mts-manager-panel">)/u, '\n');
  const workAnalyticsStart = source.indexOf('          <div class="chart-grid mts-analytics-grid">', source.indexOf('id="view-work"'));
  const workEnd = source.indexOf('\n        </div>\n\n        <div class="view" id="view-time">', source.indexOf('id="view-work"'));
  if (workAnalyticsStart >= 0 && workEnd > workAnalyticsStart) source = source.slice(0, workAnalyticsStart) + source.slice(workEnd);
  const workSegment = source.slice(source.indexOf('id="view-work"'), source.indexOf('id="view-time"'));
  if (/mts-analytics-grid|mts-insight-grid|mts-message-grid|mtsMessageForm|mtsMessageList/u.test(workSegment)) throw new Error(`Management analytics or legacy message UI still exists in Work Activity in ${basename(file)}.`);
  if (source !== original) writeFileSync(file, source, 'utf8');
  console.log(`[management-inbox] ${basename(file)} dashboard-analytics=moved inbox-pane=enabled`);
}

const appHelper = `
  /* ${marker}. */
  let internalInboxPoller=null;
  const aiInboxSeen=new Map();
  function managementWacAnalyticsAllowed(user=controlUser()||{}){
    const authority=functionalAuthority(effectiveUserOrg(user));
    return ['DEVELOPER','CEO','ADMINISTRATOR','HR_MANAGER'].includes(authority);
  }
  function setManagementAnalyticsVisible(visible){
    const el=$('wacManagementAnalytics');if(!el)return;
    el.hidden=!visible;el.setAttribute('aria-hidden',visible?'false':'true');
    if(visible)el.style.removeProperty('display');else el.style.setProperty('display','none','important');
  }
  function renderDashboardWacDaily(analytics=state.wacDashboardAnalytics){
    const host=$('mtsDailyAnalytics');if(!host)return;const rows=analytics?.daily_analytics||[];
    if(!rows.length){host.innerHTML='<div class="empty-state-mini">No completed sessions yet.</div>';if($('mtsPrevDay'))$('mtsPrevDay').disabled=true;if($('mtsNextDay'))$('mtsNextDay').disabled=true;return;}
    state.mtsAnalyticsDateIndex=Math.max(0,Math.min(rows.length-1,state.mtsAnalyticsDateIndex<0?rows.length-1:state.mtsAnalyticsDateIndex));const d=rows[state.mtsAnalyticsDateIndex];
    host.innerHTML=\`<div class="daily-date">\${esc(d.date)}</div><div class="daily-pair"><article><span class="good-dot"></span><small>Earliest clock-in</small>\${userIdentity(d.earliest?.employee_id||'',d.earliest?.employee_name||'—','', 'xs')}<strong>\${formatTime(d.earliest?.clock_in_at)}</strong></article><article><span class="warn-dot"></span><small>Latest clock-out</small>\${userIdentity(d.latest?.employee_id||'',d.latest?.employee_name||'—','', 'xs')}<strong>\${formatTime(d.latest?.clock_out_at)}</strong></article></div><div class="daily-total">Total completed hours that day <b>\${num(d.totalHours,2)}</b></div>\`;
    if($('mtsPrevDay'))$('mtsPrevDay').disabled=state.mtsAnalyticsDateIndex<=0;if($('mtsNextDay'))$('mtsNextDay').disabled=state.mtsAnalyticsDateIndex>=rows.length-1;
  }
  function renderDashboardWacCharts(analytics=state.wacDashboardAnalytics){
    if(state.view!=='dashboard'||!managementWacAnalyticsAllowed())return;const a=analytics||{},top=a.top_workers||[],d=(a.department_performance||[]).slice(0,10),p=(a.project_performance||[]).slice(0,10);
    top.length?drawHorizontalBars($('mtsTopWorkersChart'),top.map(x=>x.name),top.map(x=>x.weightedScore),'#277fa8',{people:top.map(x=>employeeRecord('',x.name))}):drawEmptyChart($('mtsTopWorkersChart'),'Waiting for live work data');
    d.length?drawHorizontalBars($('mtsDepartmentChart'),d.map(x=>x.name),d.map(x=>x.weightedScore),'#18815b'):drawEmptyChart($('mtsDepartmentChart'),'Waiting for live work data');
    p.length?drawHorizontalBars($('mtsProjectPerformanceChart'),p.map(x=>x.name),p.map(x=>x.weightedScore),'#7559a6'):drawEmptyChart($('mtsProjectPerformanceChart'),'Waiting for live work data');
  }
  function renderDashboardWacManagement(monthRows=[]){
    const allowed=managementWacAnalyticsAllowed();setManagementAnalyticsVisible(allowed);if(!allowed)return;
    const a=mtsAnalytics(monthRows||[]);state.wacDashboardAnalytics=a;
    if($('mtsKpis'))$('mtsKpis').innerHTML=[['Active sessions',a.active_sessions,'Live evidence capture',a.active_sessions?'good':''],['Completed sessions',a.completed_sessions,'Clocked-out work records',''],['Recorded hours',num(a.total_hours,2),'Operational elapsed time',''],['Average completion',\`\${num(a.average_completion,1)}%\`,'Task counter-check',''],['Recovery drafts',a.recovery_drafts,'Linked to Recovery Time Entry',a.recovery_drafts?'good':''],['Overtime flags',a.overtime.length,'More than 8 hrs/day',a.overtime.length?'warn':'good']].map(x=>\`<article class="kpi-card \${x[3]}"><small>\${x[0]}</small><b>\${x[1]}</b><span>\${x[2]}</span></article>\`).join('');
    const emp=a.employee_of_month;if($('mtsEmployeeMonth'))$('mtsEmployeeMonth').innerHTML=emp?\`<span>★</span>\${userIdentity('',emp.name,'','sm')}<strong>\${num(emp.weightedScore,1)} performance index</strong><small>\${num(emp.totalHours,2)} hrs · \${num(emp.averageCompletion,1)}% average completion</small>\`:'<span>☆</span><b>No completed sessions yet</b><small>Performance is management information only.</small>';
    if($('mtsJobsList'))$('mtsJobsList').innerHTML=a.jobs_analytics.length?a.jobs_analytics.map(x=>\`<div><span><b>\${esc(x.project_code)}</b><small>\${num(x.totalHours,2)} hours</small></span><strong>\${x.completed}/\${x.total}</strong></div>\`).join(''):'<p class="muted">No completed jobs yet.</p>';
    if($('mtsOvertimeList'))$('mtsOvertimeList').innerHTML=a.overtime.length?a.overtime.map(x=>\`<div class="risk-row"><span>\${userIdentity('',x.employee_name,x.date,'xs')}</span><strong>\${num(x.hours,2)} hrs</strong></div>\`).join(''):'<p class="muted">No overtime above 8 hours/day in the selected records.</p>';
    renderDashboardWacDaily(a);requestAnimationFrame(()=>renderDashboardWacCharts(a));
  }
  async function loadInternalInbox(force=false){
    if(!browserSessionToken){state.internalInbox={messages:[],recipients:[],unread:0};return state.internalInbox;}
    try{const b=await supabaseRpc('assurance_regent_browser_message_bundle',{p_token:browserSessionToken},{bypassCache:force});state.internalInbox={messages:Array.isArray(b?.messages)?b.messages:[],recipients:Array.isArray(b?.recipients)?b.recipients:[],unread:Number(b?.unread||0)};return state.internalInbox;}catch(err){console.warn('Internal inbox unavailable',err);return state.internalInbox||{messages:[],recipients:[],unread:0};}
  }
  function inboxAvatar(row){
    if(String(row?.kind||'').toUpperCase()==='AI'||String(row?.senderId||'').toUpperCase()==='JIVAN')return '<span class="inbox-avatar inbox-avatar-ai" title="Jivan">✦</span>';
    const photo=safeProfilePhoto(row?.senderPhoto||''),name=row?.senderName||'User';return photo?\`<span class="inbox-avatar"><img src="\${esc(photo)}" alt="\${esc(name)}" /></span>\`:\`<span class="inbox-avatar">\${esc(companyInitials(name))}</span>\`;
  }
  function populateInboxRecipients(){
    const select=$('inboxRecipientSelect');if(!select)return;const keep=select.value,q=String($('inboxRecipientSearch')?.value||'').trim().toLowerCase(),rows=(state.internalInbox?.recipients||[]).filter(x=>!q||[x.name,x.email,x.position,x.department,x.id].join(' ').toLowerCase().includes(q));select.innerHTML='<option value="">Select user</option>'+rows.map(x=>\`<option value="\${esc(x.id)}">\${esc(x.name||x.id)}\${x.position?\` — \${esc(x.position)}\`:''}\${x.department?\` · \${esc(x.department)}\`:''}</option>\`).join('');if(rows.some(x=>String(x.id)===String(keep)))select.value=keep;
  }
  function renderInternalInbox(){
    const host=$('internalInboxList');if(!host)return;populateInboxRecipients();const filter=state.internalInboxFilter||'all',rows=(state.internalInbox?.messages||[]).filter(x=>filter==='unread'?(x.direction==='IN'&&!x.read):filter==='ai'?String(x.kind||'').toUpperCase()==='AI':true);document.querySelectorAll('[data-inbox-filter]').forEach(b=>b.classList.toggle('active',b.dataset.inboxFilter===filter));
    host.innerHTML=rows.length?rows.map(x=>{const incoming=x.direction==='IN',unread=incoming&&!x.read,ai=String(x.kind||'').toUpperCase()==='AI',name=incoming?(x.senderName||'User'):(x.recipientName||'User'),meta=ai?'Jivan · AI reminder':incoming?(x.senderPosition||'Internal user'):'Sent message',attachment=x.attachmentFileId?\`<button type="button" class="inbox-attachment" data-inbox-attachment="\${esc(x.attachmentFileId)}" data-inbox-attachment-name="\${encodeURIComponent(x.attachmentName||'attachment')}">📎 \${esc(x.attachmentName||'Attachment')}</button>\`:'';return \`<article class="inbox-message \${incoming?'incoming':'outgoing'} \${unread?'unread':''} \${ai?'ai-message':''}" data-inbox-message="\${esc(x.id)}"><div class="inbox-message-avatar">\${incoming?inboxAvatar(x):'<span class="inbox-avatar inbox-avatar-sent">↗</span>'}</div><div class="inbox-message-main"><div class="inbox-message-head"><div><b>\${esc(name)}</b><small>\${esc(meta)}</small></div><time>\${formatDateTime(x.createdAt)}</time></div><p>\${esc(x.content)}</p><div class="inbox-message-actions">\${attachment}\${unread?\`<button type="button" class="text-link" data-inbox-read="\${esc(x.id)}">Mark read</button>\`:''}</div></div></article>\`;}).join(''):'<div class="control-empty"><b>No messages here</b><span>Private messages and Jivan reminders will appear in this inbox.</span></div>';
    host.querySelectorAll('[data-inbox-read]').forEach(b=>b.addEventListener('click',()=>markInternalInboxRead(b.dataset.inboxRead)));host.querySelectorAll('[data-inbox-attachment]').forEach(b=>b.addEventListener('click',()=>openPersistentFile(b.dataset.inboxAttachment,decodeURIComponent(b.dataset.inboxAttachmentName||'attachment')).catch(err=>toast(err.message))));
  }
  async function sendInternalInboxMessage(e){
    e?.preventDefault?.();const recipient=$('inboxRecipientSelect')?.value||'',content=$('inboxMessageContent')?.value.trim()||'',file=$('inboxAttachmentFile')?.files?.[0];if(!recipient)return toast('Select a recipient.');if(!content)return toast('Write a message before sending.');const submit=$('internalMessageForm')?.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Sending…';}
    try{let attachment=null;if(file)attachment=await uploadPersistentFile(file,{category:'internal-message',entityType:'internal-message',entityId:crypto.randomUUID(),metadata:{recipientId:recipient}});await supabaseRpc('assurance_regent_browser_message_send',{p_token:browserSessionToken,p_recipient_id:recipient,p_content:content,p_attachment_file_id:attachment?.fileId||null});if($('inboxMessageContent'))$('inboxMessageContent').value='';if($('inboxAttachmentFile'))$('inboxAttachmentFile').value='';if($('inboxAttachmentName'))$('inboxAttachmentName').textContent='';await loadInternalInbox(true);renderInternalInbox();renderControlDock();toast('Private internal message sent.');}
    catch(err){toast(err.message||'Could not send the internal message.');}finally{if(submit){submit.disabled=false;submit.textContent='Send';}}
  }
  async function markInternalInboxRead(id){try{await supabaseRpc('assurance_regent_browser_message_mark_read',{p_token:browserSessionToken,p_message_id:id});await loadInternalInbox(true);renderInternalInbox();renderControlDock();}catch(err){toast(err.message||'Could not mark the message read.');}}
  function queueAiInboxMessage(text,label='Jivan'){
    const value=String(text||'').trim();if(!browserSessionToken||!value)return;const key=\`\${label}|\${value.slice(0,240)}\`,now=Date.now(),last=aiInboxSeen.get(key)||0;if(now-last<10*60*1000)return;aiInboxSeen.set(key,now);supabaseRpc('assurance_regent_browser_message_ai_self',{p_token:browserSessionToken,p_content:value,p_label:String(label||'Jivan').replace(/ notification$/i,'')||'Jivan',p_metadata:{source:'JIVAN_PROACTIVE'}},{bypassCache:true}).then(()=>loadInternalInbox(true)).then(()=>{renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();}).catch(()=>{});
  }
  function startInternalInboxPolling(){if(internalInboxPoller)clearInterval(internalInboxPoller);internalInboxPoller=setInterval(()=>{if(!browserSessionToken||document.hidden)return;loadInternalInbox(true).then(()=>{renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();}).catch(()=>{});},15000);}
`;

function patchApp(file) {
  let source = readFileSync(file, 'utf8');
  const original = source;
  if (!source.includes(marker)) {
    const anchor = '  async function renderDashboard(){';
    if (!source.includes(anchor)) throw new Error(`Dashboard function anchor missing in ${basename(file)}.`);
    source = source.replace(anchor, `${appHelper}\n${anchor}`);
  }
  source = source.replace("'assurance_regent_browser_jivan_studio_get','assurance_regent_browser_recruitment_bundle'", "'assurance_regent_browser_jivan_studio_get','assurance_regent_browser_recruitment_bundle','assurance_regent_browser_message_bundle'");
  source = source.replace('assurance_regent_browser_recruitment_bundle:5000};', 'assurance_regent_browser_recruitment_bundle:5000,assurance_regent_browser_message_bundle:2500};');
  source = source.replace("recruitmentBusy:false };", "recruitmentBusy:false, internalInbox:{messages:[],recipients:[],unread:0}, internalInboxFilter:'all', wacDashboardAnalytics:null };");
  source = source.replace("async function renderMts(){if(!$('mtsKpis'))return;await loadMtsData();populateMtsMasters();renderMtsActive();renderMtsTable();renderMtsAnalytics();renderMtsMessages();}", "async function renderMts(){await loadMtsData();populateMtsMasters();renderMtsActive();renderMtsTable();}");
  source = source.replace("['mtsSearch','mtsMonthFilter','mtsYearFilter'].forEach(id=>$(id).addEventListener(id==='mtsSearch'?'input':'change',()=>{renderMtsTable();renderMtsAnalytics();}));", "['mtsSearch','mtsMonthFilter','mtsYearFilter'].forEach(id=>$(id).addEventListener(id==='mtsSearch'?'input':'change',()=>{renderMtsTable();}));");
  source = source.replace("$('mtsPrevDay').addEventListener('click',()=>{state.mtsAnalyticsDateIndex=Math.max(0,state.mtsAnalyticsDateIndex-1);renderMtsDaily();});", "$('mtsPrevDay')?.addEventListener('click',()=>{state.mtsAnalyticsDateIndex=Math.max(0,state.mtsAnalyticsDateIndex-1);renderDashboardWacDaily();});");
  source = source.replace("$('mtsNextDay').addEventListener('click',()=>{const dates=currentMtsAnalytics().daily_analytics||[];state.mtsAnalyticsDateIndex=Math.min(Math.max(0,dates.length-1),state.mtsAnalyticsDateIndex+1);renderMtsDaily();});", "$('mtsNextDay')?.addEventListener('click',()=>{const dates=state.wacDashboardAnalytics?.daily_analytics||[];state.mtsAnalyticsDateIndex=Math.min(Math.max(0,dates.length-1),state.mtsAnalyticsDateIndex+1);renderDashboardWacDaily();});");
  source = source.replace("$('mtsMessageForm').addEventListener('submit',async e=>{e.preventDefault();await sendMtsMessage();});", "$('mtsMessageForm')?.addEventListener('submit',async e=>{e.preventDefault();await sendMtsMessage();});");
  source = source.replace("const callAnchor_DO_NOT_MATCH='';", "const callAnchor_DO_NOT_MATCH='';");
  const dashCall = "    paginateTable('dashboardBody',true);\n    applyDashboardAnalyticsAccess(monthRows,a,d);\n    requestAnimationFrame(renderDashboardCharts);";
  const dashCallFallback = "    paginateTable('dashboardBody',true);\n    requestAnimationFrame(renderDashboardCharts);";
  const dashNext = "    paginateTable('dashboardBody',true);\n    applyDashboardAnalyticsAccess(monthRows,a,d);\n    renderDashboardWacManagement(monthRows);\n    requestAnimationFrame(renderDashboardCharts);";
  if (source.includes(dashCall)) source = source.replace(dashCall, dashNext);
  else if (source.includes(dashCallFallback)) source = source.replace(dashCallFallback, "    paginateTable('dashboardBody',true);\n    renderDashboardWacManagement(monthRows);\n    requestAnimationFrame(renderDashboardCharts);");
  else if (!source.includes('renderDashboardWacManagement(monthRows);')) throw new Error(`Dashboard WAC render call missing in ${basename(file)}.`);
  source = source.replace("const agentHiddenPanels=new Set(['profile','settings','reviews','notifications']);", "const agentHiddenPanels=new Set(['profile','settings','reviews','notifications','messages']);");
  source = source.replace("const titles={notifications:['Notifications','Pending tasks, unread messages and assigned approvals.'],documents:", "const titles={notifications:['Notifications','Pending tasks and assigned approvals.'],messages:['Messages','Private internal messages, attachments and Jivan reminders.'],documents:");
  source = source.replace("if(panel==='notifications')renderNotificationsPane();if(panel==='documents')", "if(panel==='notifications')renderNotificationsPane();if(panel==='messages'){renderInternalInbox();loadInternalInbox(true).then(()=>{renderInternalInbox();renderControlDock();}).catch(()=>{});}if(panel==='documents')");
  source = source.replace("const c=state.control||defaultLocalControl(),rows=c.notifications||[],counts=", "const c=state.control||defaultLocalControl(),rows=(c.notifications||[]).filter(x=>x.kind!=='message'),counts=");
  source = source.replace("const c=state.control||defaultLocalControl(),u=c.profile?.currentUser,n=u?(c.notifications||[]).filter(x=>['message','advisor','task','review','account_approval','leave_approval','recruitment_application'].includes(String(x.kind||''))).length:0,d=", "const c=state.control||defaultLocalControl(),u=c.profile?.currentUser,n=u?(c.notifications||[]).filter(x=>['advisor','task','review','account_approval','leave_approval','recruitment_application'].includes(String(x.kind||''))).length:0,m=u?Number(state.internalInbox?.unread||0):0,d=");
  source = source.replace("[['notificationBadge',n],['documentBadge',d],['reviewBadge',r]]", "[['notificationBadge',n],['inboxBadge',m],['documentBadge',d],['reviewBadge',r]]");
  source = source.replace("await loadControlCenter();if(recruitmentHrAllowed())", "await loadControlCenter();await loadInternalInbox().catch(()=>{});if(recruitmentHrAllowed())");
  source = source.replace("$('controlDrawerClose')?.addEventListener('click',closeControlDrawer);$('controlDrawerBackdrop')?.addEventListener('click',closeControlDrawer);", "$('controlDrawerClose')?.addEventListener('click',closeControlDrawer);$('controlDrawerBackdrop')?.addEventListener('click',closeControlDrawer);$('internalMessageForm')?.addEventListener('submit',sendInternalInboxMessage);$('inboxComposeToggle')?.addEventListener('click',()=>{const f=$('internalMessageForm');if(f)f.hidden=!f.hidden;});$('inboxRecipientSearch')?.addEventListener('input',populateInboxRecipients);$('inboxAttachmentFile')?.addEventListener('change',()=>{if($('inboxAttachmentName'))$('inboxAttachmentName').textContent=$('inboxAttachmentFile')?.files?.[0]?.name||'';});$('inboxFilterTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-inbox-filter]');if(!b)return;state.internalInboxFilter=b.dataset.inboxFilter;renderInternalInbox();});startInternalInboxPolling();");
  source = source.replace("showMessage:(text,label='Jivan notification')=>addMessage('assistant',String(text||''),false,label),", "showMessage:(text,label='Jivan notification')=>{const value=String(text||'');addMessage('assistant',value,false,label);queueAiInboxMessage(value,label);},");
  if (!source.includes('assurance_regent_browser_message_send') || !source.includes('renderDashboardWacManagement(monthRows);')) throw new Error(`Internal inbox or dashboard management analytics patch incomplete in ${basename(file)}.`);
  if (source !== original) writeFileSync(file, source, 'utf8');
  console.log(`[management-inbox] ${basename(file)} management-analytics=dashboard private-inbox=rpc`);
}

function patchAgent(file) {
  let source = readFileSync(file, 'utf8');const original=source;
  source = source.replace("#controlDrawer:not([hidden]) [data-control-pane=\"notifications\"]:not([hidden])", "#controlDrawer:not([hidden]) [data-control-pane=\"notifications\"]:not([hidden]), #controlDrawer:not([hidden]) [data-control-pane=\"messages\"]:not([hidden])");
  if (source !== original) writeFileSync(file, source, 'utf8');
  console.log(`[management-inbox] ${basename(file)} inbox-overlap-guard=enabled`);
}

for (const file of htmlTargets) patchHtml(file);
for (const file of appTargets.filter(existsSync)) patchApp(file);
for (const file of agentTargets.filter(existsSync)) patchAgent(file);
console.log(`[management-inbox] patched ${htmlTargets.length} HTML, ${appTargets.filter(existsSync).length} app runtime and ${agentTargets.filter(existsSync).length} agent runtime file(s).`);
