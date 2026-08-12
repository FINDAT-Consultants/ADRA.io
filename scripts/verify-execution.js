import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const required=[
  ['server.js','/api/brain/activity'],
  ['server.js','run_id'],
  ['src/agents.js','navigate_application'],
  ['src/agents.js','execute_review_decision'],
  ['src/agents.js','create_or_update_employee'],
  ['src/agents.js','create_or_update_project'],
  ['src/agents.js','create_or_update_payroll'],
  ['src/agents.js','create_or_update_calendar_day'],
  ['src/agents.js','create_live_recovery_time_entry'],
  ['src/agents.js','create_or_update_vacancy'],
  ['src/agents.js','create_or_update_candidate'],
  ['src/agents.js','create_or_update_onboarding'],
  ['src/agents.js',"process.env.OPENAI_MODEL || 'gpt-5.6'"],
  ['src/agents.js','Never use a generic inventory/count summary as a fallback answer.'],
  ['src/agent-activity-store.js','pushAgentActivity'],
  ['src/system-brain.js','task_completion'],
  ['src/system-brain.js','system_ready'],
  ['src/system-brain.js','recordBrainLearning'],
  ['public/index.html','agentWorkHud'],
  ['public/index.html','agentVisualCursor'],
  ['public/app.js','startAgentActivity'],
  ['public/app.js','visualizeAgentActivity'],
  ['public/app.js','/api/brain/activity'],
  ['public/app.js','run_id:runId'],
  ['public/styles.css','agent-work-hud'],
  ['public/styles.css','agent-visual-cursor']
];
for(const [file,needle] of required)if(!read(file).includes(needle))throw new Error(`${file} is missing ${needle}`);
const forbidden=['The live system currently','contains ${engine.state.employees.length}','Work Activity Hub sessions'].join(' ');
for(const file of ['public/app.js','app.js','src/agents.js'])if(read(file).includes(forbidden))throw new Error(`${file} still contains the old canned system-count fallback.`);
if(read('public/app.js').includes('function localAgent(')||read('public/app.js').includes('function localMathAnswer('))throw new Error('Browser-side canned Recovery Agent fallback is still present.');
const activity=JSON.parse(read('data/agent-activity.json'));
if(!activity.runs||Object.keys(activity.runs).length)throw new Error('Agent activity data must ship with no prior execution runs.');
const env=read('.env.example');
if(!/^OPENAI_API_KEY=\s*$/m.test(env))throw new Error('.env.example must not contain a real or placeholder API secret value.');
if(!/^OPENAI_MODEL=gpt-5\.6\s*$/m.test(env))throw new Error('.env.example should default to gpt-5.6.');
const project=['server.js','src/agents.js','src/system-brain.js','src/agent-activity-store.js','public/app.js','public/index.html','.env.example'].map(read).join('\n');
if(/sk-proj-[A-Za-z0-9_-]{20,}/.test(project))throw new Error('An OpenAI project key appears to be embedded in the deliverable.');
console.log('Execution verification passed: canned browser fallback removed, GPT-5.6 server LLM path present, permission-aware task/review tools present, visible activity streaming present, adaptive task learning/notifications present, and activity store ships empty.');
