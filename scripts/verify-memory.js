import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
function check(ok, label, detail='') {
  if (!ok) { console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`); process.exitCode = 1; }
  else console.log(`PASS ${label}${detail ? `: ${detail}` : ''}`);
}

const kb = readJson('data/knowledge-base.json');
const full = readJson('data/source_document_fulltext.json');
const memory = readJson('data/system-memory.json');
const formulas = readJson('data/workbook_formula_catalog.json');
const snapshot = readJson('data/training/workbook-demo-reference.json').workbook_data;

check(Array.isArray(kb.records) && kb.records.length >= 20, 'knowledge chunks', String(kb.records?.length || 0));
check(Array.isArray(full.blocks) && full.blocks.length >= 100, 'source document blocks', String(full.blocks?.length || 0));
check(Array.isArray(memory) && memory.length >= 5, 'seeded persistent memories', String(memory.length));
check(Array.isArray(formulas) && formulas.length === 52, 'formula catalog', String(formulas.length));
check(Object.keys(snapshot).length === 11, 'embedded workbook sheets', String(Object.keys(snapshot).length));

const titles = new Set(memory.map(x => x.title));
check(titles.has('Recovery Passport five-key gate'), 'five-key policy memory');
check(titles.has('Deterministic financial authority'), 'deterministic authority memory');
check(titles.has('AI role boundary'), 'AI boundary memory');
check(titles.has('Learning from confirmed decisions'), 'confirmed-learning memory');
check(titles.has('Unified Work-Evidence Spine'), 'unified work-evidence memory');

const requiredFiles = [
  'data/system-records.json',
  'data/conversation-sessions.json',
  'data/agent-actions.json',
  'data/runtime-time-entries.json',
  'src/knowledge-base.js',
  'src/memory-store.js',
  'src/record-store.js',
  'src/persistent-session.js',
  'src/operational-store.js',
  'supabase/migrations/003_agent_memory_knowledge_tasks.sql',
  'src/mts-store.js',
  'supabase/migrations/004_mts_unified_evidence_spine.sql'
];
for (const f of requiredFiles) check(fs.existsSync(path.join(root,f)), `exists ${f}`);

const workbookHash = sha256('data/source/ADRA_Recovery_Assurance_Engine_Prototype.xls');
const docHash = sha256('data/source/Cost Recovery.docx');
check(workbookHash === '9da43591bd5e68884864a16abc77dd825e3dee5e70d505e458d370ebb6d7b2bd', 'source workbook fingerprint', workbookHash);
check(docHash === '00e9352d93b04e5160d8ac0326e7a1a2238fa482f53fa82a41344282382bc054', 'source document fingerprint', docHash);

if (!process.exitCode) console.log('\nIntelligent memory verification passed.');
