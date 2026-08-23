import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const targets = [resolve(root, 'app.js')];
if (existsSync(publicDir)) {
  for (const name of readdirSync(publicDir)) {
    if (/^app(?:\.|-).*\.js$/iu.test(name)) targets.push(join(publicDir, name));
  }
}

const COMPANY_HUB_REFRESH = "if(state.companyTab==='hub')renderCompanyHub();if(browserSessionToken)loadCompanyDirectoryHub(false).then(changed=>{if(changed)renderCompany();}).catch(()=>{});";
const BIND_CONTROL_START = '  function bindControlCenter(){';
const BIND_CONTROL_END = '  function bindCloseButtons(){';

const CONTROL_SINGLETONS = [
  "$('internalMessageForm')?.addEventListener('submit',sendInternalInboxMessage);",
  "$('inboxComposeToggle')?.addEventListener('click',()=>{const f=$('internalMessageForm');if(f)f.hidden=!f.hidden;});",
  "$('inboxRecipientSearch')?.addEventListener('input',populateInboxRecipients);",
  "$('inboxAttachmentFile')?.addEventListener('change',()=>{if($('inboxAttachmentName'))$('inboxAttachmentName').textContent=$('inboxAttachmentFile')?.files?.[0]?.name||'';});",
  "$('inboxFilterTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-inbox-filter]');if(!b)return;state.internalInboxFilter=b.dataset.inboxFilter;renderInternalInbox();});",
  'startInternalInboxPolling();',
  'bindAiCompanyHubUi();',
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseConsecutive(source, token) {
  const pattern = new RegExp(`(?:${escapeRegex(token)}){2,}`, 'gu');
  return source.replace(pattern, token);
}

function dedupeWithinControlCenter(source, token) {
  const start = source.indexOf(BIND_CONTROL_START);
  const end = start >= 0 ? source.indexOf(BIND_CONTROL_END, start) : -1;
  if (start < 0 || end < 0) return { source, removed: 0 };

  const before = source.slice(0, start);
  let block = source.slice(start, end);
  const after = source.slice(end);
  const pattern = new RegExp(escapeRegex(token), 'gu');
  let seen = false;
  let removed = 0;
  block = block.replace(pattern, (match) => {
    if (!seen) {
      seen = true;
      return match;
    }
    removed++;
    return '';
  });
  return { source: before + block + after, removed };
}

function normalize(source) {
  const changes = [];
  let next = source;

  const rpcBefore = (next.match(/'assurance_regent_browser_message_bundle'/gu) || []).length;
  next = next.replace(
    /(?:\s*,\s*'assurance_regent_browser_message_bundle'){2,}/gu,
    ",'assurance_regent_browser_message_bundle'",
  );
  const rpcAfter = (next.match(/'assurance_regent_browser_message_bundle'/gu) || []).length;
  if (rpcAfter < rpcBefore) changes.push(`read-rpc-duplicates:${rpcBefore - rpcAfter}`);

  const companyBefore = next.split(COMPANY_HUB_REFRESH).length - 1;
  next = collapseConsecutive(next, COMPANY_HUB_REFRESH);
  const companyAfter = next.split(COMPANY_HUB_REFRESH).length - 1;
  if (companyAfter < companyBefore) changes.push(`company-hub-refresh-duplicates:${companyBefore - companyAfter}`);

  for (const token of CONTROL_SINGLETONS) {
    const result = dedupeWithinControlCenter(next, token);
    next = result.source;
    if (result.removed) changes.push(`control-binding:${token.slice(0, 42)}:${result.removed}`);
  }

  return { source: next, changes };
}

let totalChanged = 0;
for (const file of targets) {
  if (!existsSync(file)) continue;
  const original = readFileSync(file, 'utf8');
  if (!original.trim()) throw new Error(`Refusing to normalize empty runtime: ${file}`);
  const result = normalize(original);
  if (result.source !== original) {
    writeFileSync(file, result.source, 'utf8');
    totalChanged++;
  }
  console.log(`[runtime-normalize] ${basename(file)} ${result.changes.length ? result.changes.join(', ') : 'already-clean'}`);
}

console.log(`[runtime-normalize] completed across ${targets.length} runtime file(s); ${totalChanged} file(s) changed.`);
