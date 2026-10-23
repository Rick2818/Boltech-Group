import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../lib/agent1_evidence_executor.js';
function response(){return {statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}}}
test('rejects GET',async()=>{const res=response();await handler({method:'GET',headers:{}},res);assert.equal(res.statusCode,405)});
test('rejects unauthenticated POST',async()=>{const res=response();await handler({method:'POST',headers:{}},res);assert.equal(res.statusCode,401)});
