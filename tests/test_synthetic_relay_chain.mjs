import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
const run=(id,stage)=>{const r=spawnSync(process.execPath,['scripts/qa/synthetic_campaign.mjs',id,'--relay-chain','--stage='+stage],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
test('one synthetic case traverses real A1/A2/A3 consumers in separate isolated processes',async()=>{
 const id='QA-relay-'+randomUUID(),stages=['RSI-01','RSI-02-HOLD','DIRECTORA','RSI-02-TRANSFER','RSI-03','VERIFY'];let final;
 for(const stage of stages){const first=run(id,stage);assert.equal(first.reused,false);const replay=run(id,stage);assert.equal(replay.reused,true);assert.deepEqual(replay.receipt,first.receipt);final=first;}
 assert.equal(final.receipt.result.status,'ISOLATED_AGENT_RELAY_CHAIN_PASS');assert.equal(final.receipt.result.completedHandoffs,2);assert.equal(final.receipt.result.realEmails,0);
 const db=JSON.parse(await readFile(`ops-output/synthetic-qa/${id}/relay-state.json`,'utf8'));assert.equal(db.receipts.length,6);assert.equal(db.simulatedGatewayReads,1);assert.ok(db.mailReads.some(r=>r.stage==='RSI-03'));assert.equal(db.originalLead.fields['Data Quality'],'QA');
});
