/* Server-side deterministic engine loaded only with LIVE operational data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_FILE = path.join(__dirname, '..', 'data', 'live-system-data.json');

globalThis.window = globalThis;
globalThis.ADRA_WORKBOOK_DATA = {};
await import('../workbook-engine.js');

async function readLiveState() {
  try { return JSON.parse(await fs.readFile(LIVE_FILE, 'utf8')); }
  catch { return { employees:[], projects:[], payroll:[], calendar:[], timeEntries:[], sources:[], sourceChecks:[], vacancies:[], candidates:[], onboarding:[] }; }
}

export const engine = globalThis.ADRAEngine.createEngine(await readLiveState());
export const formulaCatalog = globalThis.ADRAEngine.formulaCatalog;
