import test from 'node:test';import assert from 'node:assert/strict';import {reviewBlockers} from '../lib/director_blocker_tracking.js';
test('escalates only after three observed cycles and never asserts resolution',()=>{
 const b=[{role:'RSI-03',code:'COST_EVIDENCE_INCOMPLETE',owner:'RSI-03'}];
 const a=reviewBlockers([],b,'2026-10-18T15:00:00Z');
 const c=reviewBlockers(a.active,b,'2026-10-18T16:00:00Z');
 const d=reviewBlockers(c.active,b,'2026-10-18T17:00:00Z');
 assert.equal(a.escalations.length,0);assert.equal(d.escalations.length,1);
 const missing=reviewBlockers(d.active,[],'2026-10-18T18:00:00Z');
 assert.equal(missing.absent[0].status,'AWAITING_RESOLUTION_EVIDENCE');
});
test('resolution must match role and blocker, carry proof, and cannot override active failure',()=>{
 const b={role:'RSI-03',code:'COST_EVIDENCE_INCOMPLETE',firstSeen:'2026-10-18T15:00:00Z'};
 const proof={role:'RSI-03',code:b.code,verified:true,evidenceRef:'provider-receipt',resolvedAt:'2026-10-18T16:00:00Z'};
 for(const invalid of [{...proof,role:'RSI-02'},{...proof,verified:false},{...proof,evidenceRef:''},{...proof,resolvedAt:'2026-10-19T00:00:00Z'}])assert.equal(reviewBlockers([b],[],'2026-10-18T17:00:00Z',[invalid]).absent.length,1);
 assert.equal(reviewBlockers([b],[b],'2026-10-18T17:00:00Z',[proof]).active.length,1);
 assert.equal(reviewBlockers([b],[],'2026-10-18T17:00:00Z',[proof]).resolved.length,1);
});
