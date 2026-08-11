import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServerSupabase, hasSupabaseConfig } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'system-memory.json');

function words(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}
function similarity(query, text) {
  const A = words(query), B = words(text);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common += 1;
  return common / Math.sqrt(A.size * B.size);
}
async function readLocal() { try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return []; } }
async function writeLocal(rows) { await fs.writeFile(FILE, JSON.stringify(rows, null, 2)); }

export async function listMemories({ limit = 100, category, authority } = {}) {
  let rows;
  if (hasSupabaseConfig()) {
    const db = createServerSupabase();
    let q = db.from('agent_memories').select('*').order('updated_at', { ascending: false }).limit(limit);
    if (category) q = q.eq('category', category);
    if (authority) q = q.eq('authority', authority);
    const { data, error } = await q;
    if (error) throw error;
    rows = data || [];
  } else {
    rows = await readLocal();
    if (category) rows = rows.filter((x) => x.category === category);
    if (authority) rows = rows.filter((x) => x.authority === authority);
    rows = rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, limit);
  }
  return rows;
}

export async function searchMemories(query, { limit = 8 } = {}) {
  const rows = await listMemories({ limit: 500 });
  return rows
    .map((r) => ({ ...r, relevance: similarity(query, `${r.title || ''} ${r.content || ''} ${(r.tags || []).join(' ')}`) }))
    .filter((r) => r.relevance > 0)
    .sort((a, b) => (b.relevance - a.relevance) || (Number(b.importance || 0) - Number(a.importance || 0)))
    .slice(0, limit);
}

export async function saveMemory({ title, content, category = 'fact', authority = 'CONFIRMED', importance = 0.7, sourceType = 'user', sourceRef = '', tags = [], metadata = {}, sessionId = '' }) {
  const now = new Date().toISOString();
  const clean = {
    title: String(title || '').trim(), content: String(content || '').trim(), category: String(category || 'fact'),
    authority: String(authority || 'CONFIRMED'), importance: Math.max(0, Math.min(1, Number(importance || 0.7))),
    source_type: String(sourceType || 'user'), source_ref: String(sourceRef || ''), tags: Array.isArray(tags) ? tags.map(String) : [],
    metadata: metadata && typeof metadata === 'object' ? metadata : {}, session_id: String(sessionId || ''), updated_at: now
  };
  if (!clean.title || !clean.content) throw new Error('Memory title and content are required.');

  if (hasSupabaseConfig()) {
    const db = createServerSupabase();
    const { data, error } = await db.from('agent_memories').insert({ ...clean, created_at: now }).select('*').single();
    if (error) throw error;
    return data;
  }
  const rows = await readLocal();
  const row = { id: randomUUID(), ...clean, created_at: now };
  rows.unshift(row);
  await writeLocal(rows);
  return row;
}

export async function deleteMemory(id) {
  if (hasSupabaseConfig()) {
    const db = createServerSupabase();
    const { error } = await db.from('agent_memories').delete().eq('id', id);
    if (error) throw error;
    return { deleted: true, id };
  }
  const rows = await readLocal();
  const next = rows.filter((x) => String(x.id) !== String(id));
  await writeLocal(next);
  return { deleted: next.length !== rows.length, id };
}

export async function memoryOverview() {
  const rows = await listMemories({ limit: 1000 });
  const byAuthority = {}, byCategory = {};
  for (const r of rows) {
    byAuthority[r.authority || 'UNKNOWN'] = (byAuthority[r.authority || 'UNKNOWN'] || 0) + 1;
    byCategory[r.category || 'other'] = (byCategory[r.category || 'other'] || 0) + 1;
  }
  return { count: rows.length, by_authority: byAuthority, by_category: byCategory };
}
