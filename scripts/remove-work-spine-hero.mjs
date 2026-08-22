import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [resolve('index.html'), resolve('public/index.html')].filter(existsSync);
if (!targets.length) throw new Error('No Assurance Regent index page was found.');

const heroPattern = /\n?\s*<section class="work-spine-hero">[\s\S]*?<\/section>\s*\n?/u;
const marker = 'One work-evidence spine from activity to recoverable cost.';

for (const file of targets) {
  const before = readFileSync(file, 'utf8');
  const matches = before.match(new RegExp(heroPattern.source, 'gu')) || [];
  if (!before.includes('id="view-work"') || !before.includes('class="work-layout"')) {
    throw new Error(`${file} work activity page structure is missing.`);
  }
  if (matches.length === 0) {
    if (before.includes(marker) || before.includes('class="work-spine-hero"')) {
      throw new Error(`${file} contains incomplete work-evidence hero markup.`);
    }
    console.log(`[ui-cleanup] work-spine hero already absent from ${file}`);
    continue;
  }
  if (matches.length > 1) {
    throw new Error(`${file} expected exactly one work-spine hero, found ${matches.length}.`);
  }
  const after = before.replace(heroPattern, '\n');
  if (after.includes(marker) || after.includes('class="work-spine-hero"')) {
    throw new Error(`${file} still contains the removed work-evidence hero.`);
  }
  writeFileSync(file, after);
  console.log(`[ui-cleanup] removed work-spine hero from ${file}`);
}
