import test from 'node:test';
import assert from 'node:assert/strict';
import {remediationFor} from '../lib/director_remediation.js';
test('Director assigns blockers to accountable agents',()=>{
 assert.equal(remediationFor('WAITING_VERIFIED_PARTNER').owner,'MARKETING');
 assert.equal(remediationFor('COST_EVIDENCE_INCOMPLETE').owner,'RSI-03');
 assert.equal(remediationFor('WAITING_QUALIFIED_APPROVED_CASE').owner,'RSI-02');
 assert.equal(remediationFor('UNKNOWN_BLOCKER').owner,'DIRECTORA');
});
