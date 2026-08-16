import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root=process.cwd(),publicDir=resolve(root,'public'),targets=[resolve(root,'app.js')];
if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
const oneLine="  function startInternalInboxPolling(){if(internalInboxPoller)clearInterval(internalInboxPoller);internalInboxPoller=setInterval(()=>{if(!browserSessionToken||document.hidden)return;loadInternalInbox(true).then(()=>{renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();}).catch(()=>{});},15000);}";
const stable="  function startInternalInboxPolling(){\n    if(internalInboxPoller)clearInterval(internalInboxPoller);internalInboxPoller=setInterval(()=>{if(!browserSessionToken||document.hidden)return;loadInternalInbox(true).then(()=>{renderControlDock();if(state.controlPanel==='messages')renderInternalInbox();}).catch(()=>{});},15000);\n  }";
for(const file of targets.filter(existsSync)){
  let source=readFileSync(file,'utf8');
  if(source.includes(oneLine)){source=source.replace(oneLine,stable);writeFileSync(file,source,'utf8');}
  if(!source.includes(stable))throw new Error(`Could not stabilize Inbox poller anchor in ${basename(file)}.`);
  console.log(`[threaded-inbox-anchor] ${basename(file)} poller-anchor=stable`);
}
