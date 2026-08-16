import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd();
const publicDir=resolve(root,'public');
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync);
const appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));

const compactLink='  <link rel="stylesheet" href="./access-roles-polish.css?v=6.3.31" />\n';
const segmentLink='  <link rel="stylesheet" href="./access-roles-segments.css?v=6.3.32" />\n';
const segmentSource=resolve(root,'access-roles-segments.css');
if(!existsSync(segmentSource))throw new Error('Segmented Access & Roles stylesheet is missing.');
if(existsSync(publicDir))writeFileSync(join(publicDir,'access-roles-segments.css'),readFileSync(segmentSource,'utf8'),'utf8');

for(const file of htmlTargets){
  let html=readFileSync(file,'utf8');
  if(!html.includes('access-roles-polish.css?v=6.3.31'))html=html.replace('</head>',`${compactLink}</head>`);
  if(!html.includes('access-roles-segments.css?v=6.3.32'))html=html.replace('</head>',`${segmentLink}</head>`);
  if(!html.includes('id="accessManagementSection"'))throw new Error(`Access & Roles section is missing in ${file}.`);
  writeFileSync(file,html,'utf8');
  console.log(`[access-roles-polish] ${basename(file)} compact-access-layout=enabled segmented-zones=enabled`);
}

const helper=`
  /* Assurance Regent v6.3.32 — semantic Access & Roles segmentation. */
  const ACCESS_ZONE_INFO={
    people:['People & accounts','Create, select and manage individual user access.'],
    authority:['Roles & authority','Assign functional roles and management authority.'],
    company:['Company controls','Manage company access, service state and directory controls.'],
    approval:['Approvals & controls','Review or apply controlled access and approval changes.']
  };
  function accessZoneKind(text='',index=0){
    const t=String(text||'').toLowerCase();
    if(/company|billing|subscription|service|offline|payment|monthly amount|directory/.test(t))return 'company';
    if(/approval|approve|review|request|control/.test(t))return 'approval';
    if(/role|authority|permission|developer|administrator|chief executive|ceo|manager|supervisor/.test(t))return 'authority';
    if(/user|employee|account|email|invite|person|staff/.test(t))return 'people';
    return ['people','authority','approval','company'][Math.abs(Number(index)||0)%4];
  }
  function ensureAccessZoneLabel(node,kind){
    if(!node||node.querySelector(':scope > .access-zone-label'))return;
    const info=ACCESS_ZONE_INFO[kind]||ACCESS_ZONE_INFO.people,head=document.createElement('div'),dot=document.createElement('span'),copy=document.createElement('div'),title=document.createElement('b'),desc=document.createElement('small');
    head.className='access-zone-label';dot.className='access-zone-dot';title.textContent=info[0];desc.textContent=info[1];copy.append(title,desc);head.append(dot,copy);node.prepend(head);
  }
  function accessActionKind(label=''){
    const t=String(label||'').toLowerCase();
    if(/delete|remove|revoke|disable|terminate|unlink/.test(t))return 'danger';
    if(/reject|suspend|pause|block|offline/.test(t))return 'warning';
    if(/approve|enable|restore|add|create|invite|activate/.test(t))return 'positive';
    if(/save|apply|update|assign|grant|set|change/.test(t))return 'primary';
    return 'neutral';
  }
  function clarifyAccessButton(button){
    if(!button||button.dataset.accessClarified==='true')return;button.dataset.accessClarified='true';
    const original=String(button.textContent||'').trim(),key=original.toLowerCase(),companyContext=Boolean(button.closest('.company-create-box,.developer-company-directory'));
    const exact={save:'Save access',apply:'Apply role',update:'Update access',approve:'Approve access',reject:'Reject request',remove:'Remove access',delete:'Delete account',disable:'Disable access',enable:'Enable access',restore:'Restore access',edit:'Edit access',open:'Open details'};
    let label=exact[key]||original;
    if(key==='add')label=companyContext?'Add company':'Add user';
    if(key==='create')label=companyContext?'Create company':'Create account';
    if(button.childElementCount===0&&label&&label!==original)button.textContent=label;
    const kind=accessActionKind(label||original),notes={primary:'Applies the selected role or access change.',positive:'Adds, approves or restores access.',warning:'Places access or service into a restricted state.',danger:'Removes or disables access. Review before continuing.',neutral:'Opens or edits the selected access record.'};
    button.classList.add('access-action-button','access-action-'+kind);button.title=notes[kind]||notes.neutral;
    if(!button.getAttribute('aria-label'))button.setAttribute('aria-label',(label||original)+'. '+(notes[kind]||notes.neutral));
  }
  function ensureAccessLegend(section){
    if(!section||section.querySelector('.access-zone-legend'))return;
    const legend=document.createElement('div');legend.className='access-zone-legend';
    [['people','User access'],['authority','Roles'],['company','Company'],['approval','Approvals']].forEach(entry=>{const chip=document.createElement('span'),dot=document.createElement('i');chip.className=entry[0];chip.append(dot,document.createTextNode(entry[1]));legend.append(chip);});
    const head=section.querySelector('.settings-section-head');if(head)head.insertAdjacentElement('afterend',legend);else section.prepend(legend);
  }
  function decorateAccessRolesUi(){
    const section=$('accessManagementSection');if(!section)return;
    const longNote=section.querySelector('.department-authority-note');if(longNote)longNote.remove();
    const headCopy=section.querySelector('.settings-section-head small');if(headCopy)headCopy.textContent='Manage user access, functional roles, approvals and company-level controls.';
    ensureAccessLegend(section);
    const grid=section.querySelector('.access-admin-grid');if(grid)[...grid.children].forEach((card,index)=>{if(!card.matches('article,section,div,form'))return;const kind=accessZoneKind(card.textContent,index);card.classList.remove('access-zone-people','access-zone-authority','access-zone-company','access-zone-approval');card.classList.add('access-zone-card','access-zone-'+kind);ensureAccessZoneLabel(card,kind);});
    const companyBox=section.querySelector('.company-create-box');if(companyBox){companyBox.classList.add('access-zone-card','access-zone-company');ensureAccessZoneLabel(companyBox,'company');}
    const directory=section.querySelector('.developer-company-directory');if(directory){directory.classList.add('access-zone-card','access-zone-company');ensureAccessZoneLabel(directory,'company');}
    section.querySelectorAll('button').forEach(clarifyAccessButton);
  }
`;

for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),original=source;
  if(!source.includes('function decorateAccessRolesUi(){')){
    const anchor='  function renderSettingsPane(){';
    if(!source.includes(anchor))throw new Error(`Settings renderer anchor missing in ${basename(file)}.`);
    source=source.replace(anchor,`${helper}\n${anchor}`);
  }
  const openSettings="if(panel==='settings'){renderSettingsPane();bindSettingsModalUi();showSettingsPage(settingsActivePage||'general');}";
  const segmentedSettings="if(panel==='settings'){renderSettingsPane();bindSettingsModalUi();showSettingsPage(settingsActivePage||'general');decorateAccessRolesUi();setTimeout(decorateAccessRolesUi,80);setTimeout(decorateAccessRolesUi,500);}";
  if(source.includes(openSettings))source=source.replace(openSettings,segmentedSettings);
  if(!source.includes('function decorateAccessRolesUi(){')||!source.includes('access-zone-legend')||!source.includes('setTimeout(decorateAccessRolesUi,500)'))throw new Error(`Access & Roles segmentation runtime patch incomplete in ${basename(file)}.`);
  if(source!==original)writeFileSync(file,source,'utf8');
  console.log(`[access-roles-polish] ${basename(file)} semantic-zones=enabled buttons=clarified department-note=removed`);
}
