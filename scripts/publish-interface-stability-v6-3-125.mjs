import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const publicDir=resolve(root,'public');
const jsName='interface-stability-v6-3-125.js';
const cssName='interface-stability-v6-3-125.css';
const sourceJs=resolve(root,jsName);
const sourceCss=resolve(root,cssName);
const publicJs=resolve(publicDir,jsName);
const publicCss=resolve(publicDir,cssName);
const rootIndex=resolve(root,'index.html');
const publicIndex=resolve(publicDir,'index.html');

for(const file of [sourceJs,sourceCss,rootIndex,publicIndex])if(!existsSync(file))throw new Error(`Required v6.3.125 interface input is missing: ${file}`);
const syntax=spawnSync(process.execPath,['--check',sourceJs],{encoding:'utf8'});
if(syntax.status!==0)throw new Error(syntax.stderr||syntax.stdout||'Interface stability runtime syntax check failed.');

const source=readFileSync(sourceJs,'utf8');
const css=readFileSync(sourceCss,'utf8');
for(const token of ["const SCHEMA='6.3.125'",'rendererCssDriftFixes:true','employeeMonthOverlapFix:true','jobsAnalyticsRowFix:true','dailyEvidenceMarkupFix:true','dynamicClippingDiagnostics:true'])if(!source.includes(token))throw new Error(`v6.3.125 interface runtime is missing ${token}.`);
for(const token of ['#mtsEmployeeMonth>.user-identity','#mtsJobsList>div','.daily-pair>article','.company-workspace','.control-drawer','.modal{','[data-ui-clipped125'])if(!css.includes(token))throw new Error(`v6.3.125 interface CSS is missing ${token}.`);

copyFileSync(sourceJs,publicJs);
copyFileSync(sourceCss,publicCss);

const sha384=file=>`sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const version=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
const esc=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function stripAsset(html,name,kind){
  const e=esc(name);
  if(kind==='script')return html.replace(new RegExp(`\\s*<script\\b[^>]*\\bsrc=["']\\./${e}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`giu`),'');
  return html.replace(new RegExp(`\\s*<link\\b[^>]*\\bhref=["']\\./${e}(?:\\?[^"']*)?["'][^>]*>`,`giu`),'');
}

function patch(file,{publicArtifact=false}={}){
  let html=readFileSync(file,'utf8');
  html=stripAsset(html,jsName,'script');
  html=stripAsset(html,cssName,'link');
  const jsFile=publicArtifact?publicJs:sourceJs,cssFile=publicArtifact?publicCss:sourceCss;
  const jsV=version(jsFile),cssV=version(cssFile);
  const cssTag=publicArtifact
    ?`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" integrity="${sha384(cssFile)}" crossorigin="anonymous" />`
    :`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" />`;
  if(!/<\/head>/iu.test(html))throw new Error(`Cannot find </head> in ${file}.`);
  html=html.replace(/<\/head>/iu,`${cssTag}\n</head>`);

  const scriptTag=publicArtifact
    ?`  <script src="./${jsName}?v=${jsV}" integrity="${sha384(jsFile)}" crossorigin="anonymous"></script>`
    :`  <script src="./${jsName}?v=${jsV}"></script>`;
  const country=/<script\b[^>]*\bsrc=["']\.\/country-select-v6-3-124\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
  const app=/<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
  if(country.test(html))html=html.replace(country,m=>`${m}\n${scriptTag}`);
  else if(app.test(html))html=html.replace(app,m=>`${m}\n${scriptTag}`);
  else if(/<\/body>/iu.test(html))html=html.replace(/<\/body>/iu,`${scriptTag}\n</body>`);
  else throw new Error(`Cannot find a runtime insertion point in ${file}.`);
  writeFileSync(file,html,'utf8');
}

patch(rootIndex);
patch(publicIndex,{publicArtifact:true});

const published=readFileSync(publicIndex,'utf8');
const jsV=version(publicJs),cssV=version(publicCss);
if(!published.includes(`src="./${jsName}?v=${jsV}"`)||!published.includes(`integrity="${sha384(publicJs)}"`))throw new Error('Published v6.3.125 JS binding failed.');
if(!published.includes(`href="./${cssName}?v=${cssV}"`)||!published.includes(`integrity="${sha384(publicCss)}"`))throw new Error('Published v6.3.125 CSS binding failed.');
if((published.match(/interface-stability-v6-3-125\.js/g)||[]).length!==1)throw new Error('Published v6.3.125 JS is duplicated.');
if((published.match(/interface-stability-v6-3-125\.css/g)||[]).length!==1)throw new Error('Published v6.3.125 CSS is duplicated.');
console.log(`[publish-interface-stability-v6-3-125] public-assets=2 js=${jsV} css=${cssV} sri=ok`);
