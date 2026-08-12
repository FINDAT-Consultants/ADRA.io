import { engine } from '../src/engine-runtime.js';
import { trainingOverview } from '../src/training-data-store.js';

const checks=[];
const add=(label,ok,detail='')=>checks.push({label,ok:Boolean(ok),detail});
const d=engine.dashboard();
add('live employees start empty',engine.state.employees.length===0,String(engine.state.employees.length));
add('live projects start empty',engine.state.projects.length===0,String(engine.state.projects.length));
add('live payroll starts empty',engine.state.payroll.length===0,String(engine.state.payroll.length));
add('live calendar starts empty',engine.state.calendar.length===0,String(engine.state.calendar.length));
add('live time starts empty',engine.state.timeEntries.length===0,String(engine.state.timeEntries.length));
add('dashboard starts without monthly rows',d.monthly.length===0,String(d.monthly.length));
add('empty controls wait for data',engine.checks().modelStatus==='WAITING FOR DATA',engine.checks().modelStatus);
add('empty payroll is not configured',engine.checks().configurationStatus==='NOT CONFIGURED',engine.checks().configurationStatus);
const training=await trainingOverview();
add('historical archive classified as training only',training.classification==='TRAINING_REFERENCE_ONLY',training.classification);
add('historical archive is non-live',training.authority==='NON_LIVE_NON_POSTING',training.authority);
add('historical archive retained',training.sheets.some(x=>x.rows>0),`${training.sheets.length} sheets`);
let failed=false;for(const c of checks){console.log(`${c.ok?'PASS':'FAIL'} ${c.label}${c.detail?`: ${c.detail}`:''}`);if(!c.ok)failed=true;}if(failed)process.exit(1);console.log('Live-engine separation verification passed.');
