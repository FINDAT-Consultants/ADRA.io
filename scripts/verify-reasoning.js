import fs from 'node:fs';
import { calculateExpression, summarizeNumbers, solveProbability } from '../src/math-engine.js';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const near=(a,b,t=1e-10)=>Math.abs(a-b)<=t;
const calc=calculateExpression('sqrt(144) + 2^5');
if(calc.result!==44)throw new Error('Deterministic expression calculator failed.');
const stats=summarizeNumbers([1,2,3,4,5]);
if(stats.mean!==3||!near(stats.stddev,Math.sqrt(2)))throw new Error('Statistics solver failed.');
const bayes=solveProbability({mode:'bayes',prior:0.1,likelihood:0.9,alternativeLikelihood:0.2});
if(!near(bayes.posterior,1/3))throw new Error('Bayes probability solver failed.');
const required=[
  ['src/agents.js','Mathematics and Quantitative Reasoning Agent'],
  ['src/agents.js','For CAUSAL questions'],
  ['src/agents.js','estimated relative probabilities'],
  ['src/system-brain.js','ADRA Predictive Compose'],
  ['src/system-brain.js','predictSystemBrainContinuation'],
  ['server.js','/api/brain/predict'],
  ['public/index.html','predictiveCompose'],
  ['public/app.js','loadPredictiveCompose'],
  ['public/app.js','deterministicMath'],
  ['public/styles.css','predictive-compose-option']
];
for(const [file,needle] of required)if(!read(file).includes(needle))throw new Error(`${file} is missing ${needle}`);
const project=['server.js','src/agents.js','src/system-brain.js','src/math-engine.js','public/app.js','public/index.html'].map(read).join('\n');
if(/sk-proj-[A-Za-z0-9_-]{20,}/.test(project))throw new Error('An API key appears to be embedded in the project.');
console.log('Reasoning verification passed: contextual/causal conversation instructions, deterministic math/statistics/probability tools, predictive compose, probability labelling, and secret-key boundary are present.');
