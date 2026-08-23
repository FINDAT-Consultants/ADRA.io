import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const CONTROL_SINGLETONS = [
  "$('internalMessageForm')?.addEventListener('submit',sendInternalInboxMessage);",
  "$('inboxComposeToggle')?.addEventListener('click',()=>{const f=$('internalMessageForm');if(f)f.hidden=!f.hidden;});",
  "$('inboxRecipientSearch')?.addEventListener('input',populateInboxRecipients);",
  "$('inboxAttachmentFile')?.addEventListener('change',()=>{if($('inboxAttachmentName'))$('inboxAttachmentName').textContent=$('inboxAttachmentFile')?.files?.[0]?.name||'';});",
  "$('inboxFilterTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-inbox-filter]');if(!b)return;state.internalInboxFilter=b.dataset.inboxFilter;renderInternalInbox();});",
  'startInternalInboxPolling();',
  'bindAiCompanyHubUi();',
];

function count(source, token) {
  return source.split(token).length - 1;
}

for (const file of targets) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (!source.trim()) throw new Error(`${basename(file)} is empty.`);

  const readStart = source.indexOf('const READ_RPC_NAMES=new Set([');
  const readEnd = readStart >= 0 ? source.indexOf(']);', readStart) : -1;
  if (readStart < 0 || readEnd < 0) throw new Error(`${basename(file)} is missing READ_RPC_NAMES.`);
  const readBlock = source.slice(readStart, readEnd);
  const messageBundleCount = count(readBlock, "'assurance_regent_browser_message_bundle'");
  if (messageBundleCount !== 1) {
    throw new Error(`${basename(file)} has ${messageBundleCount} message-bundle entries in READ_RPC_NAMES; expected exactly one.`);
  }

  if (source.includes(COMPANY_HUB_REFRESH + COMPANY_HUB_REFRESH)) {
    throw new Error(`${basename(file)} still contains consecutive duplicate Company Hub refresh logic.`);
  }

  const controlStart = source.indexOf('  function bindControlCenter(){');
  const controlEnd = controlStart >= 0 ? source.indexOf('  function bindCloseButtons(){', controlStart) : -1;
  if (controlStart < 0 || controlEnd < 0) throw new Error(`${basename(file)} is missing the Control Center binding block.`);
  const control = source.slice(controlStart, controlEnd);
  for (const token of CONTROL_SINGLETONS) {
    const occurrences = count(control, token);
    if (occurrences > 1) {
      throw new Error(`${basename(file)} still has ${occurrences} copies of a singleton Control Center binding: ${token.slice(0, 70)}`);
    }
  }

  console.log(`[runtime-normalize-verify] ${basename(file)} duplicate RPC/render/listener checks pass.`);
}
