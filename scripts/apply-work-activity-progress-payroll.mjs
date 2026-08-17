import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/work-activity-progress-payroll-v6-3-73-runtime.inc.js'),cssFile=resolve(root,'work-activity-progress-payroll.css');
if(!existsSync(runtimeFile)||!existsSync(cssFile))throw new Error('Work Activity progress/payroll v6.3.73 assets are missing.');
const runtime=readFileSync(runtimeFile,'utf8').trimEnd();
const htmlTargets=[resolve(root,'index.html'),resolve(publicDir,'index.html')].filter(existsSync),appTargets=[resolve(root,'app.js')];
if(existsSync(publicDir)){writeFileSync(join(publicDir,'work-activity-progress-payroll.css'),readFileSync(cssFile,'utf8'),'utf8');for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));}

for(const file of htmlTargets){let s=readFileSync(file,'utf8'),before=s;s=s.replace(/\s*<link rel="stylesheet" href="\.\/work-activity-progress-payroll\.css\?v=[^"]+" \/>/gu,'');const link='  <link rel="stylesheet" href="./work-activity-progress-payroll.css?v=6.3.73" />';if(s.includes('<link rel="stylesheet" href="./work-activity-job-continuity.css?v=6.3.70" />'))s=s.replace('<link rel="stylesheet" href="./work-activity-job-continuity.css?v=6.3.70" />','<link rel="stylesheet" href="./work-activity-job-continuity.css?v=6.3.70" />\n'+link);else s=s.replace('</head>',link+'\n</head>');if(s!==before)writeFileSync(file,s,'utf8');console.log(`[work-activity-progress-payroll] ${basename(file)} progress+payroll-css=enabled`);}

for(const file of appTargets.filter(existsSync)){let s=readFileSync(file,'utf8'),before=s;const block=/  \/\* Assurance Regent v6\.3\.73 — Work Activity progress \+ payroll cost bridge START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.73 — Work Activity progress \+ payroll cost bridge END \*\//u;if(block.test(s))s=s.replace(block,runtime);else{const anchor='  async function boot(){';if(!s.includes(anchor))throw new Error(`Work Activity v6.3.73 runtime anchor missing in ${basename(file)}.`);s=s.replace(anchor,runtime+'\n\n'+anchor);}for(const token of ['workActivityProgress73','job_progress_total??row.completion_percent','hourly_rate_snapshot','operational_cost','workActivityPayrollAggregate73','Work activity cost','Rate required','baseRenderMtsTable73','baseRenderPayroll73','baseCompleteMtsSession73'])if(!s.includes(token))throw new Error(`Work Activity v6.3.73 missing ${token} in ${basename(file)}.`);if(s!==before)writeFileSync(file,s,'utf8');console.log(`[work-activity-progress-payroll] ${basename(file)} cumulative-progress=bar cost-snapshot=enabled payroll-work-cost=enabled`);}

await import('./apply-work-activity-active-job-progress.mjs');
