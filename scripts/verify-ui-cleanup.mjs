import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [resolve('index.html'), resolve('public/index.html')].filter(existsSync);
if (!targets.length) throw new Error('No Assurance Regent index page was found.');

for (const file of targets) {
  const html = readFileSync(file, 'utf8');
  if (html.includes('class="work-spine-hero"')) throw new Error(`${file} still exposes the removed work-spine hero.`);
  if (html.includes('One work-evidence spine from activity to recoverable cost.')) throw new Error(`${file} still contains the removed work-evidence headline.`);
  if (html.includes('Master Time Schedule × Recovery Passport')) throw new Error(`${file} still contains the removed work-evidence banner kicker.`);
  if (!html.includes('id="view-work"') || !html.includes('class="work-layout"')) throw new Error(`${file} no longer contains the Work Activity workspace after cleanup.`);
}

console.log(`[ui-cleanup-verify] OK: work-evidence hero removed from ${targets.length} index page(s); Work Activity workspace retained.`);
