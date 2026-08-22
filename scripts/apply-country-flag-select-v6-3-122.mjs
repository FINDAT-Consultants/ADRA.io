import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

await import('./apply-all-country-selector-flags-v6-3-121.mjs');

const root=process.cwd();
const publicDir=resolve(root,'public');
const jsName='country-flag-select-v6-3-122.js';
const cssName='country-flag-select-v6-3-122.css';
const sourceJs=resolve(root,jsName);
const sourceCss=resolve(root,cssName);
if(!existsSync(sourceJs)||!existsSync(sourceCss))throw new Error('v6.3.122 country flag selector assets are missing.');

const syntax=spawnSync(process.execPath,['--check',sourceJs],{encoding:'utf8'});
if(syntax.status!==0)throw new Error(`v6.3.122 selector syntax failure:\n${syntax.stderr||syntax.stdout}`);
const js=readFileSync(sourceJs,'utf8');
for(const token of ["const SCHEMA='6.3.122'",'https://flagcdn.com/w40/','settingsCurrencyCountry','newCompanyCountry','companyExecutiveCountry','companyProfileCountry67','[data-company-registered-country]','nativeSelectSynchronized:true','searchable:true','MutationObserver','combobox'])if(!js.includes(token))throw new Error(`v6.3.122 selector is missing ${token}.`);
const css=readFileSync(sourceCss,'utf8');
for(const token of ['.ar-country-native122','.ar-country-trigger122','.ar-country-panel122','.ar-country-option122'])if(!css.includes(token))throw new Error(`v6.3.122 selector CSS is missing ${token}.`);

if(existsSync(publicDir)){
  copyFileSync(sourceJs,resolve(publicDir,jsName));
  copyFileSync(sourceCss,resolve(publicDir,cssName));
}

const sha384=file=>`sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const version=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function patchHtml(file,{publicArtifact=false}={}){
  if(!existsSync(file))return false;
  let html=readFileSync(file,'utf8');
  const jsFile=publicArtifact?resolve(publicDir,jsName):sourceJs;
  const cssFile=publicArtifact?resolve(publicDir,cssName):sourceCss;
  const jsVersion=version(jsFile),cssVersion=version(cssFile),jsSri=sha384(jsFile),cssSri=sha384(cssFile);
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*\\bsrc=["']\\./${escapeRegex(jsName)}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`giu`),'');
  html=html.replace(new RegExp(`\\s*<link\\b[^>]*\\bhref=["']\\./${escapeRegex(cssName)}(?:\\?[^"']*)?["'][^>]*>`,`giu`),'');
  const cssTag=publicArtifact?`  <link rel="stylesheet" href="./${cssName}?v=${cssVersion}" integrity="${cssSri}" crossorigin="anonymous" />`:`  <link rel="stylesheet" href="./${cssName}?v=${jsVersion}" />`;
  if(!/<\/head>/iu.test(html))throw new Error(`v6.3.122 cannot find </head> in ${file}.`);
  html=html.replace(/<\/head>/iu,`${cssTag}\n</head>`);
  const scriptTag=publicArtifact?`  <script src="./${jsName}?v=${jsVersion}" integrity="${jsSri}" crossorigin="anonymous"></script>`:`  <script src="./${jsName}?v=${jsVersion}"></script>`;
  const appScript=/<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
  if(appScript.test(html))html=html.replace(appScript,match=>`${match}\n${scriptTag}`);
  else if(/<\/body>/iu.test(html))html=html.replace(/<\/body>/iu,`${scriptTag}\n</body>`);
  else throw new Error(`v6.3.122 cannot find an app script or </body> in ${file}.`);
  writeFileSync(file,html,'utf8');
  return true;
}
patchHtml(resolve(root,'index.html'),{publicArtifact:false});
if(existsSync(publicDir))patchHtml(resolve(publicDir,'index.html'),{publicArtifact:true});
console.log(`[country-flag-select-v6-3-122] image-backed=1 native-sync=1 searchable=1 public=${existsSync(resolve(publicDir,'index.html'))?1:0}`);
await import('./verify-country-flag-select-v6-3-122.mjs');
