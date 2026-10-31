import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=p=>readFileSync(p,'utf8');
const home=read('index.html'), specialist=read('specialist.html');
const reception=read('assets/js/web-reception.js');

test('six distinct numbered specialties and no former Quinta Celia number in homepage',()=>{
 const links=[...home.matchAll(/href="\/specialist\.html\?type=([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(links,['sales','support','marketing','finance','logistics','chemistry']);
 assert.doesNotMatch(home,/wa\.me\/50375743444/);
 for(let n=1;n<=6;n++)assert.match(home,new RegExp('Agente 0'+n));
});
test('all specialty pages can render a named agent, with visible fallback and optional voice',()=>{
 assert.match(specialist,/const agentNumbers=\{/);
 assert.match(specialist,/requestedType==='pharma'\?'chemistry'/);
 assert.match(specialist,/id="portrait"/);
 assert.match(specialist,/id="replay"/);
 assert.match(specialist,/let speakReplies=\('speechSynthesis' in window\)/);
 assert.match(specialist,/id="listen"/);
 assert.match(specialist,/requestSubmit\(\)/);
 assert.match(specialist,/dataset\.welcome/);
});
test('language controls include bilingual floating intake',()=>{
 assert.match(home,/boltech:language-change/);
 assert.match(reception,/boltech:language-change/);
 assert.match(reception,/What do you need to automate\?/);
 assert.match(reception,/¿Qué necesitas automatizar\?/);
});
test('browser inline scripts are syntactically parseable',()=>{
 for(const [name,html] of [['index',home],['specialist',specialist],['leo',read('sales-agent.html')]]){
  const scripts=[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length>=1,name+' has inline JavaScript');
  for(const script of scripts)new Script(script,{filename:name+'.js'});
 }
});
test('specialist API does not claim or execute outbound autonomy',()=>{
 const api=read('lib/specialist_chat.js');
 assert.match(api,/externalActionsEnabled:false/);
 assert.doesNotMatch(api,/sendMail\(|sendEmail\(|sendMessage\(/);
});
