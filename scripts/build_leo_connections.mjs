// Standalone Direct Upload bundle. Source modules are inlined, never served as assets.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=resolve('cloudflare/leo-connections');
const output=resolve(process.argv[2] || 'dist-leo-connections');
if(output===source) throw Error('OUTPUT_MUST_DIFFER_FROM_SOURCE');
await mkdir(output,{recursive:true});
const stripImports=s=>s.replace(/^import .*;\r?\n/gm,'');
const oauth=await readFile(source+'/upwork-oauth.mjs','utf8');
const upwork=stripImports(await readFile(source+'/upwork.mjs','utf8'));
const worker=stripImports(await readFile(source+'/_worker.js','utf8'));
await writeFile(output+'/_worker.js',oauth+'\n'+upwork+'\n'+worker);
for(const name of ['sales-agent.html','_routes.json']) await copyFile(source+'/'+name,output+'/'+name);
console.log('Built standalone Leo connections bundle: '+output);
