const FUNCTIONS = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const clean = v => String(v ?? '').trim();

function tokenize(expression){
  const src=clean(expression); if(!src)throw new Error('Expression is required.');
  const tokens=[]; let i=0;
  while(i<src.length){
    const rest=src.slice(i),ws=rest.match(/^\s+/); if(ws){i+=ws[0].length;continue;}
    const number=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i); if(number){tokens.push({type:'number',value:number[0]});i+=number[0].length;continue;}
    const ident=rest.match(/^[A-Za-z_][A-Za-z_0-9]*/); if(ident){tokens.push({type:'identifier',value:ident[0].toLowerCase()});i+=ident[0].length;continue;}
    const ch=rest[0]; if('+-*/%^(),'.includes(ch)){tokens.push({type:'symbol',value:ch});i++;continue;}
    throw new Error(`Unsupported character in expression: ${ch}`);
  }
  return tokens;
}

export function calculateExpression(expression){
  const tokens=tokenize(expression); const names=Object.keys(FUNCTIONS); const args=Object.values(FUNCTIONS);
  const rebuilt=tokens.map((t,idx)=>{
    if(t.type==='number')return t.value;
    if(t.type==='symbol')return t.value==='^'?'**':t.value;
    const name=t.value;
    if(Object.prototype.hasOwnProperty.call(CONSTANTS,name))return String(CONSTANTS[name]);
    if(Object.prototype.hasOwnProperty.call(FUNCTIONS,name)){
      const next=tokens[idx+1]; if(!next||next.value!=='(')throw new Error(`${name} must be used as a function.`); return name;
    }
    throw new Error(`Unsupported identifier: ${name}`);
  }).join('');
  // Tokenization rejects property access, quotes, assignments, brackets and statements.
  const fn=Function(...names,`"use strict"; return (${rebuilt});`); // eslint-disable-line no-new-func
  const value=fn(...args); if(typeof value!=='number'||!Number.isFinite(value))throw new Error('The calculation did not produce a finite numeric result.');
  return {expression:clean(expression),result:value};
}

function numbers(values){const v=(values||[]).map(Number);if(!v.length||v.some(x=>!Number.isFinite(x)))throw new Error('A non-empty list of finite numbers is required.');return v;}
export function summarizeNumbers(values){
  const v=numbers(values),sorted=[...v].sort((a,b)=>a-b),sum=v.reduce((a,b)=>a+b,0),mean=sum/v.length;
  const median=sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
  const variance=v.reduce((s,x)=>s+(x-mean)**2,0)/v.length;
  return {count:v.length,sum,mean,median,min:sorted[0],max:sorted.at(-1),variance,stddev:Math.sqrt(variance)};
}
function clampProbability(p,label='probability'){const n=Number(p);if(!Number.isFinite(n)||n<0||n>1)throw new Error(`${label} must be between 0 and 1.`);return n;}
function combination(n,k){n=Math.trunc(Number(n));k=Math.trunc(Number(k));if(n<0||k<0||k>n)throw new Error('Binomial n and k must satisfy n >= k >= 0.');k=Math.min(k,n-k);let out=1;for(let i=1;i<=k;i++)out=out*(n-k+i)/i;return out;}
export function solveProbability(input={}){
  const mode=clean(input.mode).toLowerCase();
  if(mode==='bayes'){
    const prior=clampProbability(input.prior,'prior'),likelihood=clampProbability(input.likelihood,'likelihood'),alternativeLikelihood=clampProbability(input.alternativeLikelihood,'alternativeLikelihood');
    const numerator=likelihood*prior,denominator=numerator+alternativeLikelihood*(1-prior); if(denominator===0)throw new Error('Bayes denominator is zero.');
    return {mode:'bayes',posterior:numerator/denominator,prior,likelihood,alternativeLikelihood};
  }
  if(mode==='binomial'){
    const n=Math.trunc(Number(input.n)),k=Math.trunc(Number(input.k)),p=clampProbability(input.p,'p'); const exact=combination(n,k)*(p**k)*((1-p)**(n-k));
    return {mode:'binomial',n,k,p,exact,expected:n*p,variance:n*p*(1-p)};
  }
  if(mode==='expected_value'){
    const vals=numbers(input.values),probs=(input.probabilities||[]).map((p,i)=>clampProbability(p,`probabilities[${i}]`));if(vals.length!==probs.length)throw new Error('values and probabilities must have the same length.');const total=probs.reduce((a,b)=>a+b,0);if(Math.abs(total-1)>.000001)throw new Error('Probabilities must sum to 1.');
    return {mode:'expected_value',expectedValue:vals.reduce((s,x,i)=>s+x*probs[i],0),values:vals,probabilities:probs};
  }
  throw new Error('Probability mode must be bayes, binomial, or expected_value.');
}
