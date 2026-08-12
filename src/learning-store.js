import { createServerSupabase } from './supabase.js';
import { scheduleIntelligenceRefresh } from './intelligence-engine.js';

async function readAll() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from('agent_learning_mappings').select('*').order('last_confirmed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function words(text) { return new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []); }
function similarity(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let common = 0; for (const x of A) if (B.has(x)) common++;
  return common / new Set([...A, ...B]).size;
}

export async function listMappings() { return readAll(); }

export async function recordMapping({ activity, projectCode, confirmedBy = 'human', note = '' }) {
  const activityExample = String(activity).trim();
  const key = activityExample.toLowerCase().replace(/\s+/g, ' ');
  const now = new Date().toISOString();
  const supabase = createServerSupabase();
  const { data: existing, error: findError } = await supabase.from('agent_learning_mappings').select('*').eq('activity_key', key).eq('project_code', projectCode).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    const { data, error } = await supabase.from('agent_learning_mappings').update({accepted_count:Number(existing.accepted_count||0)+1,last_confirmed_at:now,note:note||existing.note||'',confirmed_by:confirmedBy}).eq('id', existing.id).select('*').single();
    if (error) throw error; scheduleIntelligenceRefresh({reason:'human-confirmed-learning-updated'}); return data;
  }
  const { data, error } = await supabase.from('agent_learning_mappings').insert({activity_key:key,activity_example:activityExample,project_code:projectCode,accepted_count:1,confirmed_by:confirmedBy,note,last_confirmed_at:now}).select('*').single();
  if (error) throw error; scheduleIntelligenceRefresh({reason:'human-confirmed-learning-updated'}); return data;
}

export async function suggestFromMappings(activity) {
  const rows = await readAll();
  return rows.map(r => ({ ...r, similarity: similarity(activity, r.activity_example || r.activity_key) })).filter(r => r.similarity > 0).sort((a, b) => (b.similarity - a.similarity) || (Number(b.accepted_count) - Number(a.accepted_count))).slice(0, 5);
}
