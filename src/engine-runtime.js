/* Server-side deterministic engine loaded only with LIVE operational data. */
import { readAppState } from './supabase-state.js';

globalThis.window = globalThis;
globalThis.ADRA_WORKBOOK_DATA = {};
await import('../public/workbook-engine.js');

const EMPTY_LIVE_STATE = { employees:[], projects:[], payroll:[], calendar:[], timeEntries:[], sources:[], sourceChecks:[], vacancies:[], candidates:[], onboarding:[] };

export const engine = globalThis.ADRAEngine.createEngine(await readAppState('live-system-data', EMPTY_LIVE_STATE));
export const formulaCatalog = globalThis.ADRAEngine.formulaCatalog;
