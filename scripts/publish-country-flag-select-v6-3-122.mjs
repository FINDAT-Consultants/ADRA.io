import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public');
const jsName='country-flag-select-v6-3-122.js',cssName='country-flag-select-v6-3-122.css';
const sourceJs=resolve(root,jsName),sourceCss=resolve(root,cssName),publicJs=resolve(publicDir,jsName),publicCss=resolve(publicDir,cssName);
for(const file of [sourceJs,sourceCss,resolve(root,'index.html'),resolve(publicDir,'index.html')])if(!existsSync(file))throw new Error(`Required v6.3.122 artifact input is missing: ${file}`);
const syntax=spawnSync(process.execPath,['--check',sourceJs],{encoding:'utf8'});if(syntax.status!==0)throw new Error(syntax.stderr||syntax.stdout||'Flag selector syntax check failed.');
copyFileSync(sourceJs,publicJs);copyFileSync(sourceCss,publicCss);
const sha384=file=>`sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`;
const version=file=>createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,16);
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function patch(file,{publicArtifact=false}={}){
  let html=readFileSync(file,'utf8');
  const jsFile=publicArtifact?publicJs:sourceJs,cssFile=publicArtifact?publicCss:sourceCss;
  const jsV=version(jsFile),cssV=version(cssFile),jsSri=sha384(jsFile),cssSri=sha384(cssFile);
  html=html.replace(new RegExp(`\\s*<script\\b[^>]*\\bsrc=["']\\./${escapeRegex(jsName)}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`giu`),'');
  html=html.replace(new RegExp(`\\s*<link\\b[^>]*\\bhref=["']\\./${escapeRegex(cssName)}(?:\\?[^"']*)?["'][^>]*>`,`giu`),'');
  const cssTag=publicArtifact?`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" integrity="${cssSri}" crossorigin="anonymous" />`:`  <link rel="stylesheet" href="./${cssName}?v=${cssV}" />`;
  if(!/<\/head>/iu.test(html))throw new Error(`Cannot find </head> in ${file}.`);
  html=html.replace(/<\/head>/iu,`${cssTag}\n</head>`);
  const scriptTag=publicArtifact?`  <script src="./${jsName}?v=${jsV}" integrity="${jsSri}" crossorigin="anonymous"></script>`:`  <script src="./${jsName}?v=${jsV}"></script>`;
  const app=/<script\b[^>]*\bsrc=["']\.\/app(?:\.[^"'?]+)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/iu;
  if(app.test(html))html=html.replace(app,m=>`${m}\n${scriptTag}`);else if(/<\/body>/iu.test(html))html=html.replace(/<\/body>/iu,`${scriptTag}\n</body>`);else throw new Error(`Cannot find app script or </body> in ${file}.`);
  writeFileSync(file,html,'utf8');
}
patch(resolve(root,'index.html'));patch(resolve(publicDir,'index.html'),{publicArtifact:true});
const published=readFileSync(resolve(publicDir,'index.html'),'utf8');
if(!published.includes(`src="./${jsName}?v=${version(publicJs)}"`)||!published.includes(`integrity="${sha384(publicJs)}"`))throw new Error('Published flag selector JS binding failed.');
if(!published.includes(`href="./${cssName}?v=${version(publicCss)}"`)||!published.includes(`integrity="${sha384(publicCss)}"`))throw new Error('Published flag selector CSS binding failed.');
console.log(`[publish-country-flag-select-v6-3-122] public-assets=2 index-patched=1 sri=1 js=${version(publicJs)} css=${version(publicCss)}`);
