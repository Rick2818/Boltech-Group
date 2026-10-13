import test from 'node:test';import assert from 'node:assert/strict';
import {createAdapters} from '../asmas/integration-adapters.mjs';
test('never send or charge by default',async()=>{
 const a=createAdapters({db:{},queue:{},airtable:{},agents:{}});
 await assert.rejects(()=>a.executeOutbound({}),/OUTBOUND_DISABLED/);
 await assert.rejects(()=>a.charge({}),/CHARGES_DISABLED/);
});
test('never initialize missing dependencies silently',()=>{
 assert.throws(()=>createAdapters({db:{}}),/DEPENDENCIES_MISSING/);
});
