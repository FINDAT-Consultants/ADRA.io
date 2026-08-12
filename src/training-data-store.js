/* Backend-only historical prototype data. Never use as live accounting state. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'data', 'training', 'workbook-demo-reference.json');
let cache = null;

export async function getTrainingArchive() {
  if (!cache) cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  return cache;
}
export async function getTrainingWorkbookData() { return (await getTrainingArchive()).workbook_data || {}; }
export async function trainingOverview() {
  const archive = await getTrainingArchive();
  const wb = archive.workbook_data || {};
  return {
    classification: archive.classification,
    authority: archive.authority,
    purpose: archive.purpose,
    sheets: Object.entries(wb).map(([name, rows]) => ({ name, rows: Array.isArray(rows) ? rows.length : 0 }))
  };
}
export async function queryTrainingSheet(sheet, { offset=0, limit=25, contains='' }={}) {
  const wb = await getTrainingWorkbookData();
  let rows = Array.isArray(wb[sheet]) ? wb[sheet] : [];
  if (contains) { const q=String(contains).toLowerCase(); rows=rows.filter(r=>Array.isArray(r)&&r.some(v=>String(v??'').toLowerCase().includes(q))); }
  return { classification:'TRAINING_REFERENCE_ONLY', authority:'NON_LIVE_NON_POSTING', sheet, total_rows:rows.length, offset, limit, rows:rows.slice(offset,offset+limit) };
}
