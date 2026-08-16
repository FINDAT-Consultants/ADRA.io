import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
const root=process.cwd(),publicDir=resolve(root,'public'),targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const n of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(n))targets.push(join(publicDir,n));
let changed=0;for(const file of targets.filter(existsSync)){let s=readFileSync(file,'utf8'),before=s;
  s=s.replaceAll("if(aiSection){aiSection.dataset.permissionHidden=can?'false':'true';if(settingsActivePage!=='intelligence')aiSection.hidden=true;}","if(aiSection){aiSection.dataset.permissionHidden='false';if(settingsActivePage!=='intelligence')aiSection.hidden=true;}");
  s=s.replaceAll("if(aiNav){aiNav.dataset.permissionHidden=can?'false':'true';aiNav.hidden=!can;}","if(aiNav){aiNav.dataset.permissionHidden='false';aiNav.hidden=false;}");
  if(!s.includes("aiSection.dataset.permissionHidden='false'")||!s.includes("aiNav.dataset.permissionHidden='false';aiNav.hidden=false"))throw new Error(`AI Settings all-user visibility patch failed in ${basename(file)}`);
  if(s!==before){writeFileSync(file,s,'utf8');changed++;}console.log(`[ai-preferences-access] ${basename(file)} personal-ai-settings=all-signed-in-users`);
}console.log(`[ai-preferences-access] ${changed} runtime file(s) updated.`);
