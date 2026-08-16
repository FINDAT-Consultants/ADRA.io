import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const targets=[resolve(root,'index.html'),resolve(root,'public/index.html')].filter(existsSync);
const link='  <link rel="stylesheet" href="./access-roles-polish.css?v=6.3.31" />\n';
for(const file of targets){
  let html=readFileSync(file,'utf8');
  if(!html.includes('access-roles-polish.css?v=6.3.31'))html=html.replace('</head>',`${link}</head>`);
  if(!html.includes('id="accessManagementSection"'))throw new Error(`Access & Roles section is missing in ${file}.`);
  writeFileSync(file,html,'utf8');
  console.log(`[access-roles-polish] ${file} compact-access-layout=enabled`);
}
