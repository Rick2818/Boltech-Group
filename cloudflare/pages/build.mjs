import {copyFile, mkdir, readFile, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'dist');
const files = ['_worker.js', '_routes.json', 'sales-agent.html'];
const routes = JSON.parse(await readFile(resolve(root, 'src/_routes.json'), 'utf8'));
if (routes.version !== 1 || !routes.include.includes('/*')) throw Error('Pages must route requests through the Leo gateway');
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
for (const file of files) await copyFile(resolve(root, 'src', file), resolve(output, file));
console.log(`Leo Pages: ${files.length} allowlisted files built in ${output}`);
