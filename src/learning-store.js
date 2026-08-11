import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerSupabase, hasSupabaseConfig } from './supabase.js';
import { scheduleIntelligenceRefresh } from './intelligence-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, '..', 'data', 'agent-learning.json');

async function readLocal() {
  try { return JSON.parse(await fs.readFile(STORE, 'utf8')); }
  catch { return []; }
}

async function writeLocal(rows) {
  await fs.writeFile(STORE, JSON.stringify(rows, null, 2));
}

async function readAll() {
  if (!hasSupabaseConfig()) return readLocal();
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from('agent_learning_mappings')
    .select('*')
    .order('last_confirmed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function words(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []);
}

function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const x of A) if (B.has(x)) common++;
  return common / new Set([...A, ...B]).size;
}

export async function listMappings() { return readAll(); }

export async function recordMapping({ activity, projectCode, confirmedBy = 'human', note = '' }) {
  const activityExample = String(activity).trim();
  const key = activityExample.toLowerCase().replace(/\s+/g, ' ');
  const now = new Date().toISOString();

  if (hasSupabaseConfig()) {
    const supabase = createServerSupabase();
    const { data: existing, error: findError } = await supabase
      .from('agent_learning_mappings')
      .select('*')
      .eq('activity_key', key)
      .eq('project_code', projectCode)
      .maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { data, error } = await supabase
        .from('agent_learning_mappings')
        .update({
          accepted_count: Number(existing.accepted_count || 0) + 1,
          last_confirmed_at: now,
          note: note || existing.note || '',
          confirmed_by: confirmedBy,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      scheduleIntelligenceRefresh({reason:'human-confirmed-learning-updated'});
      return data;
    }

    const { data, error } = await supabase
      .from('agent_learning_mappings')
      .insert({
        activity_key: key,
        activity_example: activityExample,
        project_code: projectCode,
        accepted_count: 1,
        confirmed_by: confirmedBy,
        note,
        last_confirmed_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    scheduleIntelligenceRefresh({reason:'human-confirmed-learning-updated'});
    return data;
  }

  const rows = await readLocal();
  const existing = rows.find(r => r.activity_key === key && r.project_code === projectCode);
  if (existing) {
    existing.accepted_count = Number(existing.accepted_count || 0) + 1;
    existing.last_confirmed_at = now;
    existing.note = note || existing.note;
  } else {
    rows.push({
      activity_key: key,
      activity_example: activityExample,
      project_code: projectCode,
      accepted_count: 1,
      confirmed_by: confirmedBy,
      note,
      created_at: now,
      last_confirmed_at: now,
    });
  }
  await writeLocal(rows);
  scheduleIntelligenceRefresh({reason:'human-confirmed-learning-updated'});
  return rows.find(r => r.activity_key === key && r.project_code === projectCode);
}

export async function suggestFromMappings(activity) {
  const rows = await readAll();
  return rows
    .map(r => ({ ...r, similarity: similarity(activity, r.activity_example || r.activity_key) }))
    .filter(r => r.similarity > 0)
    .sort((a, b) => (b.similarity - a.similarity) || (Number(b.accepted_count) - Number(a.accepted_count)))
    .slice(0, 5);
}
