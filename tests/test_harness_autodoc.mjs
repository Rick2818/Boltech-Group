import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('autodoc event is derived from current commit, with no false certification',()=>{
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const file='docs/harness/events/'+sha+'.json';
 assert.equal(existsSync(file),true);
 const e=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(e.commit,sha);
 assert.equal(e.evidence.certification,'NOT_CERTIFIED');
 assert.equal(e.evidence.production,'NOT_VERIFIED');
 assert.ok(Array.isArray(e.files));
 assert.ok(!JSON.stringify(e).includes('PARTNER_API_TOKEN='));
});
