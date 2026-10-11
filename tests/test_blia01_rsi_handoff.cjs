const test=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../scripts/blia01-rsi-handoff.cjs');
const id='0123456789abcdef0123';
const candidate={evidence_id:id,source_url:'https://example.org/notice',title:'Request for automation',market:'US',score:65,status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false,buying_intent_verified:false};
const source={agent:'BLIA-01',mode:'DISCOVERY_RESEARCH_ONLY',generated_at:'2026-10-11T00:00:00Z',items:[candidate,candidate]};
test('deduplicated deterministic RSI handoff retains unverified state',()=>{
 const first=build(source),second=build(source);
 assert.deepEqual(first,second);
 assert.equal(first.events.length,1);
 assert.equal(first.events[0].event_type,'LEAD_RESEARCHED');
 assert.equal(first.delivery_state,'PENDING_AUTHENTICATED_INTAKE');
 assert.equal(first.events[0].payload.buyer_verified,false);
});
test('rejects falsely qualified candidates',()=>assert.throws(()=>build({...source,items:[{...candidate,buyer_verified:true}]}),/Unsafe/));
test('rejects unsafe evidence links',()=>assert.throws(()=>build({...source,items:[{...candidate,source_url:'http://example.org'}]}),/Invalid evidence/));
