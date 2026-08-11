import { createClient } from '@supabase/supabase-js';

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function createServerSupabase() {
  if (!hasSupabaseConfig()) throw new Error('Supabase server credentials are not configured.');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
