import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {orientReception,recommendReception,receptionPricing,receptionPricingEn} from '../assets/js/reception-guidance.js';

const widget=readFileSync('assets/js/web-reception.js','utf8');
const homepage=readFileSync('index.html','utf8');

test('intake guidance uses Spanish or English according to explicit language',()=>{
 const es=orientReception('seguimiento de clientes','es');
 const en=orientReception('customer followup','en');
 assert.match(es,/Podríamos|Podemos/);
 assert.match(en,/We can evaluate/);
 assert.doesNotMatch(en,/Podríamos|solicitud|Debemos/);
 const recEn=recommendReception({painPoint:'lead tracking'},'en');
 const recEs=recommendReception({painPoint:'seguimiento'},'es');
 assert.match(recEn.text,/We can review/);
 assert.match(recEs.text,/recomendamos/);
 assert.match(receptionPricingEn,/USD 600/);
 assert.match(receptionPricing,/US\$600/);
});

test('ES/EN switch keeps unfinished user draft and updates floating assistant',()=>{
 assert.match(homepage,/boltech:language-change/);
 assert.match(widget,/document.addEventListener\('boltech:language-change',applyReceptionLanguage\)/);
 assert.match(widget,/render\(\{preserveDraft:true\}\)/);
 assert.match(widget,/if\(!preserveDraft\)answer\.value=/);
 assert.match(widget,/orientReception\(value,receptionLang\)/);
 assert.match(widget,/recommendReception\(values,receptionLang\)/);
 assert.match(widget,/What do you need to automate\?/);
 assert.match(widget,/¿Qué necesitas automatizar\?/);
 assert.match(homepage,/web-reception\.js\?v=20261031-bilingual2/);
});

test('localized success and failure notices are present',()=>{
 assert.match(widget,/Request registered/);
 assert.match(widget,/Solicitud registrada/);
 assert.match(widget,/Please authorize contact/);
 assert.match(widget,/Autoriza el contacto/);
 assert.match(widget,/Microphone could not start/);
});

test('reception and home JavaScript parse without syntax errors',()=>{
 new Script(widget.replace(/^import\s+\{[^}]+\}\s+from\s+[^;]+;/,''));
 const inline=[...homepage.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 assert.ok(inline.length);
 for(const item of inline)new Script(item);
});
