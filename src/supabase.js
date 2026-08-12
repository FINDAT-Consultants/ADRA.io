import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL='https://fubqwljypdiojpbdunjc.supabase.co';
const supabaseUrl=()=>String(process.env.SUPABASE_URL||DEFAULT_SUPABASE_URL).trim();

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function createServerSupabase() {
  if (!hasSupabaseConfig()) throw new Error('Supabase server credentials are not configured.');
  return createClient(
    supabaseUrl(),
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}

export function requireSupabaseConfig() {
  if (!hasSupabaseConfig()) throw new Error('Assurance Regent requires the Supabase server secret. Configure SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) in the Netlify Functions environment.');
  return true;
}
