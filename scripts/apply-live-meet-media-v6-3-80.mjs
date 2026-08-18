import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd(),publicDir=resolve(root,'public'),runtimeFile=resolve(root,'scripts/live-meet-media-v6-3-80-runtime.inc.js'),targets=[resolve(root,'app.js')];
if(!existsSync(runtimeFile))throw new Error('Live Meet Media v6.3.80 runtime is missing.');
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const runtime=readFileSync(runtimeFile,'utf8').trimEnd(),block=/  \/\* Assurance Regent v6\.3\.80 — Jivan Live Google Meet Media assistant START \*\/[\s\S]*?  \/\* Assurance Regent v6\.3\.80 — Jivan Live Google Meet Media assistant END \*\//u;
for(const file of targets.filter(existsSync)){
  let s=readFileSync(file,'utf8'),before=s;
  if(block.test(s))s=s.replace(block,runtime);else{
    const v79='  /* Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing END */';
    if(!s.includes(v79))throw new Error(`Live Meet Media requires v6.3.79 API connections in ${basename(file)}.`);
    s=s.replace(v79,`${v79}\n\n${runtime}`);
  }
  for(const token of ['MEET_MEDIA_AUDIO_SCOPE80','meet-media-connector','Connect Live Meet','Bring Jivan live','AssuranceRegentMeetMedia','NO_ACTIVE_CONFERENCE','Waiting for Meet consent','audioTracks'])if(!s.includes(token))throw new Error(`Live Meet Media v6.3.80 missing ${token} in ${basename(file)}.`);
  if(s.indexOf('Assurance Regent v6.3.80 — Jivan Live Google Meet Media assistant START')<s.indexOf('Assurance Regent v6.3.79 — Developer-only API connections + platform-wide connector sharing START'))throw new Error(`Live Meet Media runtime order is invalid in ${basename(file)}.`);
  if(/GOCSPX-[A-Za-z0-9_-]{10,}/u.test(s)||/AIzaSy[A-Za-z0-9_-]{20,}/u.test(s))throw new Error(`Security regression: Google credential leaked into ${basename(file)}.`);
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(check.status!==0)throw new Error(`Live Meet Media syntax failure in ${basename(file)}:\n${check.stderr||check.stdout}`);
  if(s!==before)writeFileSync(file,s,'utf8');
  console.log(`[live-meet-media] ${basename(file)} live-join=enabled developer-connection=enabled audio-only=enabled`);
}
