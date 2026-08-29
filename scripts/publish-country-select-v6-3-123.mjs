import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const publicDir=resolve(root,'public');
const jsName='country-select-v6-3-123.js';
const cssName='country-select-v6-3-123.css';
const sourceJs=resolve(root,jsName);
const sourceCss=resolve(root,cssName);
const publicJs=resolve(publicDir,jsName);
const publicCss=resolve(publicDir,cssName);
for(const file of [sourceJs,sourceCss,resolve(root,'index.html'),resolve(publicDir,'index.html')])if(!existsSync(file))throw new Error(`Required v6.3.123 country-selector input is missing: ${file}`);
const syntax=spawnSync(process.execPath,['--check',sourceJs],{encoding:'utf8'});if(syntax.status!==0)throw new Error(syntax.stderr||syntax.stdout||'Country selector syntax check failed.');
const source=readFileSync(sourceJs,'utf8');
for(const token of ["const SCHEMA = '6.3.123'",'selectedFlagVisible: true','everyOptionFlagVisible: true','compactReferenceStyle: true','settingsCurrencyCountry','newCompanyCountry','companyExecutiveCountry','[data-company-registered-country]','https://flagcdn.com/w40/'])if(!source.includes(token))throw new Error(`v6.3.123 selector is missing ${token}.`);
copyFileSync(sourceJs,publicJs);copyFileSync(sourceCss,publicCss);
const sha384=file=>`sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const version=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function stripAsset(html,name,tag){const escaped=escapeRegex(name);if(tag==='script')return html.replace(new RegExp(`\\s*<script\\b[^>]*\\bsrc=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`giu`),'');return html.replace(new RegExp(`\\s*<link\\b[^>]*\\bhref=["']\\./${escaped}(?:\\?[^"']*)?["'][^>]*>`,`giu`),'');}
function patch(file,{publicArtifact=false}={}){
  let html=readFileSync(file,'utf8');
  for(const oldJs of ['country-flag-select-v6-3-122.js',jsName])html=stripAsset(html,oldJs,'script');
  for(const oldCss of ['country-flag-select-v6-3-122.css',cssName])html=stripAsset(html,oldCss,'link');
  const jsFile=publicArtifact?publicJs:sourceJs,cssFile=publicArtifact?publicCss:sourceCss;
  const jsV=version(jsFile),cssV=version(cssFile),jsSri=sha384(jsFile),cssSri=sha384(cssFile);
  const cssTag=publicArtifact?`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" integrity="${cssSri}" crossorigin="anonymous" />`:`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" />`;
  if(!/<\/head>/iu.test(html))throw new Error(`Cannot find </head> in ${file}.`);
  html=html.replace(/<\/head>/iu,`${cssTag}\n</head>`);
  const scriptTag=publicArtifact?`  <script src="./${jsName}?v=${jsV}" integrity="${jsSri}" crossorigin="anonymous"></script>`:`  <script src="./${jsName}?v=${jsV}"></script>`;
  const app=/<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
  if(app.test(html))html=html.replace(app,m=>`${m}\n${scriptTag}`);else if(/<\/body>/iu.test(html))html=html.replace(/<\/body>/iu,`${scriptTag}\n</body>`);else throw new Error(`Cannot find app script or </body> in ${file}.`);
  writeFileSync(file,html,'utf8');
}
patch(resolve(root,'index.html'));
patch(resolve(publicDir,'index.html'),{publicArtifact:true});
const published=readFileSync(resolve(publicDir,'index.html'),'utf8');
const jsV=version(publicJs),cssV=version(publicCss);
if(!published.includes(`src="./${jsName}?v=${jsV}"`)||!published.includes(`integrity="${sha384(publicJs)}"`))throw new Error('Published v6.3.123 JS binding failed.');
if(!published.includes(`href="./${cssName}?v=${cssV}"`)||!published.includes(`integrity="${sha384(publicCss)}"`))throw new Error('Published v6.3.123 CSS binding failed.');
if(published.includes('country-flag-select-v6-3-122.'))throw new Error('Old v6.3.122 selector binding is still present.');
console.log(`[publish-country-select-v6-3-123] public-assets=2 selected-flag=1 option-flags=1 compact-reference-style=1 js=${jsV} css=${cssV}`);
