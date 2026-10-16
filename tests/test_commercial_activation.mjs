import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
test('commercial action requires existing operational auth',()=>assert.match(source,/requireOperationalAuth\(req,res\)/));
test('commercial activation does not invoke SDR sending',()=>{assert.doesNotMatch(source,/createSdrDispatch|gmail\.send|\.run\(.*candidate|sdr-send/);assert.match(source,/marketing\.managePending\(\)/);});
test('commercial activation only processes existing roles',()=>{assert.match(source,/worker\.queue\('RSI-01'\)/);assert.match(source,/worker\.queue\('MARKETING'\)/)});
