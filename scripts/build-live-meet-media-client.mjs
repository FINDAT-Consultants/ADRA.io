import {existsSync,mkdirSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';

const root=process.cwd(),entry=resolve(root,'scripts/live-meet-media-client.entry.ts'),outDir=resolve(root,'public'),outfile=resolve(outDir,'meet-media-client.bundle.js');
if(!existsSync(entry))throw new Error('Live Meet Media client entry is missing.');
mkdirSync(outDir,{recursive:true});
await build({
  entryPoints:[entry],
  outfile,
  bundle:true,
  platform:'browser',
  format:'iife',
  target:['chrome94'],
  minify:true,
  sourcemap:false,
  legalComments:'eof',
  logLevel:'warning',
  banner:{js:'/* Assurance Regent v6.3.80 · Google Meet Media reference client bridge · googleworkspace/meet-media-api-samples@9baacb08c0ec3bd454816e4cf593a3f13462486b */'}
});
if(!existsSync(outfile)||statSync(outfile).size<10000)throw new Error('Live Meet Media browser bundle was not produced correctly.');
console.log(`[live-meet-media-client] bundled ${Math.round(statSync(outfile).size/1024)} KB from pinned Google reference implementation.`);
