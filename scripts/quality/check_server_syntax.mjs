import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
let files = 0;
async function check(directory) {
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(js|mjs)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', path], { cwd: root, encoding: 'utf8' });
      if (result.status !== 0) { console.error(result.stderr || result.error?.message); process.exitCode = 1; }
      files++;
    }
  }
}
for (const directory of ['api', 'lib', 'scripts']) await check(directory);
console.log(`Checked syntax of ${files} server/script modules.`);
