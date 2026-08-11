import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('.');
const excluded=new Set(['node_modules','.git']);
const suspect=/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/g;
const hits=[];
async function walk(dir){
  for(const e of await fs.readdir(dir,{withFileTypes:true})){
    if(excluded.has(e.name)||e.name==='.env')continue;
    const p=path.join(dir,e.name);if(e.isDirectory()){await walk(p);continue;}
    if(!/\.(?:js|json|html|css|md|txt|example|env)$/i.test(e.name))continue;
    let text='';try{text=await fs.readFile(p,'utf8');}catch{continue;}
    const m=text.match(suspect);if(m?.length)hits.push(path.relative(root,p));
  }
}
await walk(root);
if(hits.length)throw new Error(`Potential API secret embedded in project files: ${hits.join(', ')}`);
console.log('Secret scan passed: no OpenAI secret key pattern is embedded in project files.');
