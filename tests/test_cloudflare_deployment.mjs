import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, access, truncate, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildPublic} from '../scripts/build_cloudflare.mjs';
import worker from '../cloudflare/worker.mjs';

test('deployment excludes oversized repository archive, dependencies and backend source', async () => {
  const root=await mkdtemp(join(tmpdir(),'boltech-cloudflare-'));
  try {
    for (const dir of ['assets/js','api','node_modules/example','data']) await mkdir(join(root,dir),{recursive:true});
    for (const path of ['index.html','sales-agent.html','manifest.webmanifest','assets/js/app.js','api/index.js','node_modules/example/index.js','data/private.json','.env','UnblockAI-Shield.zip']) {
      await writeFile(join(root,path),'fixture');
    }
    await truncate(join(root,'UnblockAI-Shield.zip'),48683831);
    const output=await buildPublic(root);
    for (const path of ['index.html','sales-agent.html','assets/js/app.js','manifest.webmanifest']) await access(join(output,path));
    for (const path of ['UnblockAI-Shield.zip','node_modules','api','data','.env']) await assert.rejects(access(join(output,path)));
    await assert.rejects(access(join(output,'cloudflare/worker.mjs')));
    assert.match(await readFile(join(output,'_headers'),'utf8'),/microphone=\(self\)/);
    await writeFile(join(root,'assets/too-big.mp4'),'');
    await truncate(join(root,'assets/too-big.mp4'),25*1024*1024+1);
    await assert.rejects(buildPublic(root),/exceeds 25 MiB/);
    await rm(join(root,'assets/too-big.mp4'));
    await symlink(join(root,'.env'),join(root,'assets/leaked.js'));
    await assert.rejects(buildPublic(root),/Symbolic link/);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('API bridge preserves raw signed payloads, query, audio headers and failures', async () => {
  const original=globalThis.fetch;
  try {
    let observed;
    globalThis.fetch=async (url,options)=>{
      observed={url:String(url),options,body:options.body ? await new Response(options.body).text() : null};
      return new Response('audio',{headers:{'Content-Type':'audio/mpeg','X-Boltech-Voice-Id':'es-SV-RodrigoNeural'}});
    };
    const raw='{ "message": "hola" }';
    const response=await worker.fetch(new Request('https://boltech.example/api/index?rodrigo_speech=1',{
      method:'POST',body:raw,headers:{'Content-Type':'application/json','wompi_hash':'signature','X-Forwarded-For':'forged','CF-Connecting-IP':'192.0.2.1'}
    }),{});
    assert.equal(observed.url,'https://boltech-group.pages.dev/api?leo_speech=1');
    assert.equal(observed.body,raw);
    assert.equal(observed.options.headers.get('wompi_hash'),'signature');
    assert.equal(observed.options.headers.get('x-forwarded-for'),'192.0.2.1');
    assert.equal(observed.options.redirect,'manual');
    assert.equal(response.headers.get('X-Boltech-Voice-Id'),'es-SV-RodrigoNeural');
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(response.headers.get('X-Boltech-API-Origin'),'cloudflare-pages');
    await worker.fetch(new Request('https://boltech.example/api/index?leo_sales=1'),{});
    assert.equal(observed.url,'https://boltech-group.pages.dev/api?leo_sales=1');
    await worker.fetch(new Request('https://boltech.example/api/payments?action=status&orderId=existing'),{});
    assert.equal(observed.url,'https://boltech-group.pages.dev/api/payments?action=status&orderId=existing');
    globalThis.fetch=async()=>new Response('Unauthorized',{status:401});
    assert.equal((await worker.fetch(new Request('https://boltech.example/api/payments'),{})).status,401);
    globalThis.fetch=async()=>{throw Error('offline');};
    assert.equal((await worker.fetch(new Request('https://boltech.example/api/index?leo_sales=1'),{})).status,502);
    const staticResponse=await worker.fetch(new Request('https://boltech.example/index.html'),{ASSETS:{fetch:async()=>new Response('static')}});
    assert.equal(await staticResponse.text(),'static');
  } finally {globalThis.fetch=original;}
});
