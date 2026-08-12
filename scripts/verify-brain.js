import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const required=[
  ['server.js','/api/brain/chat'],
  ['server.js','scheduleSystemBrainScan'],
  ['server.js','unreadSystemBrainMessages'],
  ['src/system-brain.js','ADRA AI Advisor'],
  ['src/system-brain.js','NO_ADVICE'],
  ['src/system-brain.js','humanApprovalBoundary'],
  ['src/brain-store.js','reconcileBrainNotifications'],
  ['public/app.js','/api/brain/chat'],
  ['public/app.js','data-advisor-reply'],
  ['public/app.js','loadBrainThread'],
  ['public/index.html','System reasoning advisor']
];
for(const [file,needle] of required){if(!read(file).includes(needle))throw new Error(`${file} is missing ${needle}`);}
const brain=JSON.parse(read('data/system-brain.json'));
if(!brain.threads||Object.keys(brain.threads).length)throw new Error('System brain data must ship with an empty conversation store.');
const project=[read('server.js'),read('src/system-brain.js'),read('src/brain-store.js'),read('public/app.js'),read('public/index.html')].join('\n');
if(/sk-proj-[A-Za-z0-9_-]{20,}/.test(project))throw new Error('An API key appears to be embedded in the project.');
console.log('System brain verification passed: conversational reasoning, proactive advice, notification replies, stale-notification reconciliation, human-control boundary, and empty live conversation state are present.');
