import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const targets = [];

const rootApp = resolve(root, 'app.js');
if (existsSync(rootApp)) targets.push(rootApp);
if (existsSync(publicDir)) {
  for (const name of readdirSync(publicDir)) {
    if (/^app(?:\.|-).*\.js$/iu.test(name)) targets.push(join(publicDir, name));
  }
}

if (!targets.length) throw new Error('No Assurance Regent application runtime was found for the RBAC patch.');

const oldEmployeePolicy = "return {...base,role:'Employee',allowedViews:['dashboard','company','work','time','leave','employees','calendar']};}";
const employeePolicy = "return {...base,role:'Employee',allowedViews:['dashboard','work','time','leave','calendar']};}";
const oldSwitchStart = "  function switchView(view){\n    if(view==='assistant'&&!developerStudioAllowed())return false;";
const guardedSwitchStart = `  function switchView(view){\n    /* v6.3.25 — enforce functional RBAC before rendering a protected view. */\n    const accessUser=controlUser(),accessPerms=controlPermissions(),accessAllowed=new Set(accessPerms?.allowedViews||[]),accessAll=accessAllowed.has('*');\n    if(accessUser&&view!=='dashboard'&&!accessAll&&!accessAllowed.has(view)){\n      const label=authorityLabel(functionalAuthority(effectiveUserOrg(accessUser)));\n      toast(\`Access restricted: \${label} does not have access to this section.\`);\n      view='dashboard';\n    }\n    if(view==='assistant'&&!developerStudioAllowed())return false;`;

let changed = 0;
for (const file of targets) {
  let source = readFileSync(file, 'utf8');
  const original = source;

  if (source.includes(oldEmployeePolicy)) source = source.replace(oldEmployeePolicy, employeePolicy);
  else if (!source.includes(employeePolicy)) throw new Error(`Employee permission policy was not found in ${basename(file)}.`);

  if (source.includes(oldSwitchStart)) source = source.replace(oldSwitchStart, guardedSwitchStart);
  else if (!source.includes('v6.3.25 — enforce functional RBAC before rendering a protected view.')) {
    throw new Error(`switchView RBAC insertion point was not found in ${basename(file)}.`);
  }

  if (source !== original) {
    writeFileSync(file, source, 'utf8');
    changed++;
  }
  console.log(`[rbac] ${basename(file)} employee=daily-work-only direct-view-guard=enabled`);
}

console.log(`[rbac] functional sidebar policy verified across ${targets.length} runtime file(s); ${changed} file(s) updated.`);
