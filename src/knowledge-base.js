import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB_FILE = path.join(__dirname, '..', 'data', 'knowledge-base.json');
const FORMULA_FILE = path.join(__dirname, '..', 'data', 'workbook_formula_catalog.json');
const FULLTEXT_FILE = path.join(__dirname, '..', 'data', 'source_document_fulltext.json');

const STOP_WORDS = new Set('the a an and or but if then of to in on for from by with is are was were be been being this that these those it its as at into than not no yes do does did can may must should will would could all any each every one two three four five user system agent data information work cost project employee finance time hours month workbook recovery passport'.split(' '));

function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

function tokens(text) {
  return normalize(text).split(/\s+/).filter((x) => x.length > 1 && !STOP_WORDS.has(x));
}

function score(query, haystack) {
  const q = tokens(query);
  if (!q.length) return 0;
  const h = normalize(haystack);
  const hTokens = new Set(tokens(haystack));
  let points = 0;
  for (const term of q) {
    if (hTokens.has(term)) points += 2;
    if (h.includes(term)) points += 0.5;
  }
  const phrase = normalize(query);
  if (phrase.length > 5 && h.includes(phrase)) points += q.length * 3;
  return points / Math.max(1, q.length);
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

export async function getKnowledgeOverview() {
  const kb = await readJson(KB_FILE, { records: [], sources: [] });
  const formulas = await readJson(FORMULA_FILE, []);
  const full = await readJson(FULLTEXT_FILE, { blocks: [] });
  return {
    name: kb.name,
    source_files: kb.sources || [],
    knowledge_chunks: kb.records?.length || 0,
    formula_rules: formulas.length,
    source_blocks: full.blocks?.length || 0,
    authority_model: {
      calculations: 'Deterministic workbook engine',
      design_and_controls: 'Embedded Cost Recovery + MTS / Unified Work-Evidence Spine knowledge base',
      persistent_operational_memory: 'Confirmed system memory and stored system records',
      advice: 'Agent inference grounded in retrieved evidence and clearly identified as advice'
    }
  };
}

export async function searchKnowledge(query, { limit = 8 } = {}) {
  const kb = await readJson(KB_FILE, { records: [] });
  const formulas = await readJson(FORMULA_FILE, []);
  const records = (kb.records || []).map((r) => ({
    kind: 'knowledge',
    id: r.id,
    title: r.title,
    content: r.content,
    tags: r.tags || [],
    source: r.source,
    authority: r.authority || 'FOUNDATIONAL_DESIGN'
  }));
  const formulaRecords = formulas.map((f, index) => ({
    kind: 'formula',
    id: `FORMULA-${index + 1}`,
    title: `${f.sheet} — ${f.field}`,
    content: `${f.excel}\n${f.logic}`,
    tags: [f.sheet, f.field, 'formula'],
    source: 'ADRA Recovery Assurance Engine workbook',
    authority: 'DETERMINISTIC_FORMULA_DEFINITION'
  }));

  return [...records, ...formulaRecords]
    .map((r) => ({ ...r, relevance: score(query, `${r.title} ${r.tags.join(' ')} ${r.content}`) }))
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, Math.max(1, Math.min(25, limit)));
}

export async function getFullSourceDocument() {
  return readJson(FULLTEXT_FILE, { blocks: [] });
}
