import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const appRuntimeFile=resolve(root,'scripts/public-holiday-calendar-v6-3-108-app-runtime.inc.js');
const dotRuntimeFile=resolve(root,'scripts/public-holiday-calendar-v6-3-108-dot-runtime.inc.js');
const agentRuntimeFile=resolve(root,'scripts/public-holiday-calendar-v6-3-108-agent-runtime.inc.js');
if(!existsSync(appRuntimeFile)||!existsSync(dotRuntimeFile)||!existsSync(agentRuntimeFile))throw new Error('Public holiday calendar v6.3.108 runtime assets are missing.');
const appRuntime=readFileSync(appRuntimeFile,'utf8').trimEnd(),dotRuntime=readFileSync(dotRuntimeFile,'utf8').trimEnd(),agentRuntime=readFileSync(agentRuntimeFile,'utf8').trimEnd();
const appBlock=/  \/\* Assurance Regent v6\.3\.108 — country public holiday calendar \+ AI reminder feed START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.108 — country public holiday calendar \+ AI reminder feed END \*\//u;
const dotBlock=/  \/\* Assurance Regent v6\.3\.108 — public holiday calendar dot markers START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.108 — public holiday calendar dot markers END \*\//u;
const agentBlock=/  \/\* Assurance Regent v6\.3\.108 — public holiday AI reminders START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.108 — public holiday AI reminders END \*\//u;
const appTargets=[resolve(root,'app.js')],agentTargets=[resolve(root,'recovery-agent-v5.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir)){
  if(/^app(?:\.|-).*\.js$/iu.test(name))appTargets.push(join(publicDir,name));
  if(/^recovery-agent-v5(?:\.|-).*\.js$/iu.test(name))agentTargets.push(join(publicDir,name));
}
for(const file of appTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(appBlock.test(source))source=source.replace(appBlock,appRuntime);else{
    const anchor='  function renderCalendar(){';
    if(!source.includes(anchor))throw new Error(`Public holiday calendar requires renderCalendar in ${basename(file)}.`);
    source=source.replace(anchor,`${appRuntime}\n\n${anchor}`);
  }
  if(dotBlock.test(source))source=source.replace(dotBlock,dotRuntime);else{
    const anchor='  /* Assurance Regent v6.3.108 — country public holiday calendar + AI reminder feed END */';
    if(!source.includes(anchor))throw new Error(`Public holiday dot markers require the v6.3.108 app runtime in ${basename(file)}.`);
    source=source.replace(anchor,`${anchor}\n\n${dotRuntime}`);
  }
  for(const token of ['PUBLIC_HOLIDAY_CALENDAR_SCHEMA108','/api/v4/Holidays','publicHolidayEnsureReminderWindow108','ADRAHolidayCalendar','assurance-regent-holiday-ai-reminder','PUBLIC_HOLIDAY_DOT_SCHEMA108','public-holiday-dot108','publicHolidayEnhanceDashboardDots108','countryCurrencyContext:true'])if(!source.includes(token))throw new Error(`Public holiday calendar runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Public holiday calendar syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
for(const file of agentTargets.filter(existsSync)){
  let source=readFileSync(file,'utf8'),before=source;
  if(agentBlock.test(source))source=source.replace(agentBlock,agentRuntime);else{
    const anchor='\n})();',at=source.lastIndexOf(anchor);if(at<0)throw new Error(`Public holiday reminders require the Jivan IIFE closing anchor in ${basename(file)}.`);
    source=source.slice(0,at)+'\n\n'+agentRuntime+source.slice(at);
  }
  for(const token of ['PUBLIC_HOLIDAY_AI_REMINDER_SCHEMA108','Tomorrow is','windowDays:7','visualAiMessage:true','voice:false'])if(!source.includes(token))throw new Error(`Public holiday AI reminder runtime missing ${token} in ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Public holiday AI reminder syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(source!==before)writeFileSync(file,source,'utf8');
}
writeFileSync(resolve(root,'VERSION'),'6.3.108\n','utf8');
console.log('[public-holiday-calendar-v6-3-108] country-aware=enabled currency-context=enabled holiday-dots=prominent names=tooltips expected-hours=adjusted ai-reminders=visual-deduplicated provider=nager-v4');
await import('./verify-public-holiday-calendar-v6-3-108.mjs');