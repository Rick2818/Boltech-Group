import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
const activation=source.split("if(action==='commercial-activation') {")[1]?.split("if(action==='marketing-maintenance') {")[0] || '';
test('commercial activation is registered in the existing partners handler',()=>assert.ok(activation.length>0));
test('commercial activation requires existing operational auth',()=>assert.match(activation,/requireOperationalAuth\(req,res\)/));
test('commercial activation does not send bulk mail',()=>{assert.doesNotMatch(activation,/createSdrDispatch|gmail\.send|sdr-send/);assert.match(activation,/marketing\.managePending\(\)/);});
test('commercial activation only processes existing roles',()=>{assert.match(activation,/worker\.queue\('RSI-01'\)/);assert.match(activation,/worker\.queue\('MARKETING'\)/)});
