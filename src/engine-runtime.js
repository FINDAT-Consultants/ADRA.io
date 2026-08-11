/* Server-side deterministic engine loaded with mutable live operational data from Supabase. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSupabaseConfig, readAppState, supabaseRequired } from './supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_FILE = path.join(__dirname, '..', 'data', 'live-system-data.json');
const EMPTY={employees:[],projects:[],payroll:[],calendar:[],timeEntries:[],sources:[],sourceChecks:[],vacancies:[],candidates:[],onboarding:[]};

globalThis.window = globalThis;
globalThis.ADRA_WORKBOOK_DATA = {};
await import('../workbook-engine.js');

async function localSeed() {
  try { return JSON.parse(await fs.readFile(LIVE_FILE, 'utf8')); }
  catch { return structuredClone(EMPTY); }
}

async function readLiveState() {
  const seed=await localSeed();
  if(hasSupabaseConfig())return readAppState('live_system_data',seed,{seedIfMissing:true});
  if(supabaseRequired())throw new Error('Supabase is required but not configured.');
  return seed;
}

export const engine = globalThis.ADRAEngine.createEngine(await readLiveState());
export const formulaCatalog = globalThis.ADRAEngine.formulaCatalog;
