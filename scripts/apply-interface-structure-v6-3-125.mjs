import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const targets=[resolve(root,'app.js')];
const publicDir=resolve(root,'public');
if(existsSync(publicDir)){
  for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name)||name==='app.js')targets.push(resolve(publicDir,name));
}

const jobsBefore='<div><span><b>${esc(x.project_code)}</b><small>${num(x.totalHours,2)} hours</small></span><strong>${x.completed}/${x.total}</strong></div>';
const jobsAfter='<div class="analytics-row interface-analytics-row125"><span><b>${esc(x.project_code)}</b><small>${num(x.totalHours,2)} hours</small></span><strong>${x.completed}/${x.total}</strong></div>';
const scoreBefore='<strong>${num(emp.weightedScore,1)} performance index</strong><small>${num(emp.totalHours,2)} hrs · ${num(emp.averageCompletion,1)}% average completion</small>';
const scoreAfter='<strong class="winner-score125">${num(emp.weightedScore,1)} performance index</strong><small class="winner-meta125">${num(emp.totalHours,2)} hrs · ${num(emp.averageCompletion,1)}% average completion</small>';
const dailyBefore='<div class="daily-pair"><article><span class="good-dot"></span><small>Earliest clock-in</small>';
const dailyAfter='<div class="daily-pair"><article class="interface-daily-card125"><span class="good-dot"></span><small>Earliest clock-in</small>';
const dailySecondBefore='</article><article><span class="warn-dot"></span><small>Latest clock-out</small>';
const dailySecondAfter='</article><article class="interface-daily-card125"><span class="warn-dot"></span><small>Latest clock-out</small>';

let changed=0;
for(const file of [...new Set(targets)]){
  if(!existsSync(file))continue;
  let source=readFileSync(file,'utf8'),next=source;
  if(next.includes(jobsBefore))next=next.replace(jobsBefore,jobsAfter);
  if(next.includes(scoreBefore))next=next.replace(scoreBefore,scoreAfter);
  if(next.includes(dailyBefore))next=next.replace(dailyBefore,dailyAfter);
  if(next.includes(dailySecondBefore))next=next.replace(dailySecondBefore,dailySecondAfter);
  if(!next.includes('interface-analytics-row125'))throw new Error(`Could not establish Jobs Analytics structure in ${file}.`);
  if(!next.includes('winner-score125'))throw new Error(`Could not establish Employee of the Month score structure in ${file}.`);
  if(!next.includes('interface-daily-card125'))throw new Error(`Could not establish daily evidence structure in ${file}.`);
  if(next!==source){writeFileSync(file,next,'utf8');changed++;}
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(check.status!==0)throw new Error(check.stderr||check.stdout||`Syntax check failed for ${file}.`);
}
console.log(`[apply-interface-structure-v6-3-125] targets=${targets.length} changed=${changed} analytics-row=ok winner-score=ok daily-card=ok`);
