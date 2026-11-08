import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
for (const path of ['sales-agent.html','cloudflare/public/sales-agent.html']) {
 const html=readFileSync(path,'utf8');
 test(path+' keeps executable UI and request identity without granting browser authority',()=>{
  for(const script of [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]))new Script(script);
  assert.match(html,/messageId:crypto.randomUUID\(\)/);
  assert.match(html,/data.conversion/);assert.match(html,/TECHNICAL_REVIEW/);
  assert.match(html,/propuesta a[uú]n requiere aprobaci[oó]n/);
  assert.doesNotMatch(html,/JSON.stringify\(\{message:msg,[^}]*facts:/);
 });
}
