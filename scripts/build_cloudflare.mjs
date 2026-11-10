import {readdir, mkdir, rm, copyFile, lstat, writeFile} from 'node:fs/promises';
import {resolve, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function buildPublic(root) {
  const output = resolve(root, '.cloudflare/public');
  await rm(output, {recursive:true, force:true});
  await mkdir(output, {recursive:true});
  let count = 0;
  async function copy(relative) {
    const source = resolve(root, relative);
    const stat = await lstat(source);
    if (!stat.isFile()) throw Error(`Public asset must be a regular file: ${relative}`);
    if (stat.size > 25 * 1024 * 1024) throw Error(`Public asset exceeds 25 MiB: ${relative}`);
    const destination = resolve(output, relative);
    await mkdir(dirname(destination), {recursive:true});
    await copyFile(source, destination);
    count++;
  }
  // Allowlist public entry points; never publish the repository root as assets.
  for (const entry of await readdir(root, {withFileTypes:true})) {
    if (entry.isFile() && (entry.name.endsWith('.html') ||
      ['robots.txt','sitemap.xml','manifest.webmanifest','agent-card.json','boltech_logo.jpg'].includes(entry.name))) {
      await copy(entry.name);
    }
  }
  const publicExtensions = new Set(['.css','.js','.png','.jpg','.jpeg','.svg','.ico','.webp','.gif','.mp4','.webm','.mp3','.wav','.ogg','.vtt','.woff','.woff2']);
  async function copyAssets(relative) {
    for (const entry of await readdir(resolve(root, relative), {withFileTypes:true})) {
      if (entry.name.startsWith('.')) continue;
      const child = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Symbolic link in public assets: ${child}`);
      if (entry.isDirectory()) await copyAssets(child);
      else if (publicExtensions.has(extname(entry.name).toLowerCase())) await copy(child);
    }
  }
  await copyAssets('assets');
  const aliases = [
    '/boltech /boltech.html 200',
    '/partners /partner_dashboard.html 200',
    '/partner-network /partner_dashboard.html 200',
    '/cockpit /COCKPIT_EJECUTIVO_RICARDO.html 200',
    '/cabina /COCKPIT_EJECUTIVO_RICARDO.html 200',
    '/showcase /preview_videos.html 200',
    '/videos /preview_videos.html 200',
    '/audit /index.html 200',
    '/.well-known/agent-card.json /agent-card.json 200'
  ];
  await writeFile(resolve(output, '_redirects'), aliases.join('\n')+'\n');
  await writeFile(resolve(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: SAMEORIGIN\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(self), geolocation=()\n/sales-agent*\n  Cache-Control: no-store\n`);
  console.log(`Cloudflare public build: ${count} files; server source, archives and dependencies excluded.`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPublic(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
