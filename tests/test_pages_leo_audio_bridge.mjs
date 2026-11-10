import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { BACKEND_HOST } from '../cloudflare/pages-leo-audio-worker.mjs';

test('only Leo GET/HEAD uses the corrected asset; existing pages and API retain their immutable backend', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('existing page');
  };
  try {
    for (const path of ['/sales-agent', '/sales-agent.html', '/sales-agent/']) {
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev' + path), {
        ASSETS: { fetch: async () => new Response('<main>corrected Leo</main>', { headers: { 'Content-Type': 'text/html' } }) }
      });
      assert.equal(await result.text(), '<main>corrected Leo</main>');
      assert.equal(result.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(calls.length, 0);
    for (const path of ['/', '/commerce-admin', '/api?leo_speech=1', '/api/payments?action=status']) {
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev' + path), {});
      assert.equal(await result.text(), 'existing page');
      assert.equal(calls.at(-1).url, 'https://' + BACKEND_HOST + path);
    }
  } finally { globalThis.fetch = saved; }
});

test('signed raw bytes, auth, cookies, status and audio headers survive without forged forwarded IPs or redirect following', async () => {
  const saved = globalThis.fetch;
  const bytes = new Uint8Array([0, 255, 10, 13, 123, 32, 125]);
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).host, BACKEND_HOST);
    assert.equal(new URL(url).pathname, '/api//attacker.example');
    assert.equal(new URL(url).search, '?signature=a%2Bb');
    assert.equal(init.redirect, 'manual');
    assert.deepEqual(new Uint8Array(await new Response(init.body).arrayBuffer()), bytes);
    assert.equal(init.headers.get('Authorization'), 'Bearer qa-not-a-real-token');
    assert.equal(init.headers.get('Cookie'), 'session=qa');
    assert.equal(init.headers.get('x-forwarded-for'), '192.0.2.4');
    assert.equal(init.headers.get('x-forwarded-host'), null);
    return new Response('audio', { status: 206, headers: {
      'Content-Type': 'audio/mpeg', 'X-Boltech-Voice-Id': 'es-SV-RodrigoNeural', 'Set-Cookie': 'session=qa; HttpOnly; Secure'
    } });
  };
  try {
    const result = await worker.fetch(new Request('https://boltech-group.pages.dev/api//attacker.example?signature=a%2Bb', {
      method: 'POST', body: bytes, headers: { Authorization: 'Bearer qa-not-a-real-token', Cookie: 'session=qa',
        'x-forwarded-for': 'forged', 'x-forwarded-host': 'attacker.example', 'CF-Connecting-IP': '192.0.2.4' }
    }), {});
    assert.equal(result.status, 206);
    assert.equal(result.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(result.headers.get('X-Boltech-Voice-Id'), 'es-SV-RodrigoNeural');
    assert.match(result.headers.get('Set-Cookie'), /HttpOnly/);
  } finally { globalThis.fetch = saved; }
});

test('same-site redirects retain visitor host, external payment redirects remain intact, failures stay failures', async () => {
  const saved = globalThis.fetch;
  try {
    for (const [location, expected] of [
      ['https://' + BACKEND_HOST + '/sales-agent?lang=en', 'https://boltech-group.pages.dev/sales-agent?lang=en'],
      ['https://checkout.wompi.sv/qa-only', 'https://checkout.wompi.sv/qa-only']
    ]) {
      globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: location } });
      const result = await worker.fetch(new Request('https://boltech-group.pages.dev/'), {});
      assert.equal(result.status, 302);
      assert.equal(result.headers.get('Location'), expected);
    }
    globalThis.fetch = async () => new Response('denied', { status: 401 });
    assert.equal((await worker.fetch(new Request('https://boltech-group.pages.dev/api'), {})).status, 401);
    globalThis.fetch = async () => { throw Error('offline'); };
    assert.equal((await worker.fetch(new Request('https://boltech-group.pages.dev/api'), {})).status, 502);
  } finally { globalThis.fetch = saved; }
});

test('Lorena uses existing Azure credentials, escaped SSML and genuine MP3; errors never substitute another voice', async () => {
  const saved=globalThis.fetch;
  const env={AZURE_SPEECH_KEY:'qa-only',AZURE_SPEECH_REGION:'eastus'};
  const request=(text,headers={})=>new Request('https://boltech-group.pages.dev/api?leo_speech=1',{method:'POST',headers,body:JSON.stringify({text,voice:'attacker-controlled'})});
  try {
    let calls=0;
    globalThis.fetch=async (url,init)=>{
      calls++;
      assert.equal(url,'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');
      assert.equal(init.headers['Ocp-Apim-Subscription-Key'],'qa-only');
      assert.equal(init.redirect,'manual');
      assert.match(init.body,/name="es-SV-LorenaNeural"/);
      assert.match(init.body,/<prosody rate="-8%" volume="-10%">/);
      assert.doesNotMatch(init.body,/express-as|volume="[^"]*dB"/);
      assert.match(init.body,/xmlns="http:\/\/www.w3.org\/2001\/10\/synthesis"/);
      assert.match(init.body,/Hola &lt;audio src=&quot;x&quot;&gt;&amp;/);
      return new Response(new Uint8Array([73,68,51]),{headers:{'Content-Type':'audio/mpeg'}});
    };
    let result=await worker.fetch(request('Hola <audio src="x">&'),env);
    assert.equal(result.status,200);
    assert.equal(result.headers.get('X-Boltech-Voice-Id'),'es-SV-LorenaNeural');
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()),new Uint8Array([73,68,51]));
    for(const [req,configuration,status] of [
      [request('hola',{Origin:'https://attacker.example'}),env,403],
      [request('x'.repeat(801)),env,400], [request(''),env,400],
      [request('hola'),{},503], [request('hola'),{...env,AZURE_SPEECH_REGION:'evil.example/'},503]
    ]) assert.equal((await worker.fetch(req,configuration)).status,status);
    assert.equal(calls,1);
    globalThis.fetch=async()=>new Response('sensitive provider error',{status:401});
    result=await worker.fetch(request('hola'),env);
    assert.equal(result.status,502);assert.doesNotMatch(await result.text(),/sensitive|qa-only/);
    globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://attacker.example'}});
    assert.equal((await worker.fetch(request('hola'),env)).status,502);
    globalThis.fetch=async()=>{throw Error('network');};
    assert.equal((await worker.fetch(request('hola'),env)).status,502);
  }finally{globalThis.fetch=saved;}
});

test('first greeting is welcoming, never a forced business checklist; substantive and ongoing turns keep the backend', async () => {
  const {firstGreeting,WELCOME}=await import('../cloudflare/pages-leo-audio-worker.mjs');
  const request=data=>new Request('https://boltech-group.pages.dev/api?leo_sales=1',{method:'POST',body:JSON.stringify(data)});
  for(const message of ['Hola','¡Hola, Leo!','Buenos días','Hola Leo, ¿cómo estás?','Hello Leo']) {
    const response=await firstGreeting(request({message,history:[],language:'es'}));
    assert.ok(response);const data=await response.json();
    assert.equal(data.reply,WELCOME.es);assert.deepEqual(data.authorizedActions,[]);assert.equal(data.qualified,false);
    assert.doesNotMatch(data.reply,/facturas|inventarios|proceso repetitivo/i);
  }
  assert.equal((await (await firstGreeting(request({message:'Hello',language:'en'}))).json()).reply,WELCOME.en);
  for(const data of [
    {message:'Hola, necesito facturar'}, {message:'Hola, paga esta factura'},
    {message:'Hola',history:[{role:'user',text:'Ayuda con mi pedido'}]},
    {message:'Hola',history:'bad'}, {message:123}, null
  ]) assert.equal(await firstGreeting(request(data)),null);
  const saved=globalThis.fetch;
  try {
    globalThis.fetch=async(url,init)=>{assert.equal(new URL(url).host,BACKEND_HOST);assert.equal(JSON.parse(await new Response(init.body).text()).message,'Hola, necesito facturar');return Response.json({success:true,reply:'existing response'});};
    const result=await worker.fetch(request({message:'Hola, necesito facturar',history:[]}),{});
    assert.equal((await result.json()).reply,'existing response');
  }finally{globalThis.fetch=saved;}
});
