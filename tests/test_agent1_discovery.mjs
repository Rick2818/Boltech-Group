import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('discovery produces no implicit outbound or purchase commands',()=>{const s=readFileSync('scripts/commercial/agent1_autonomous_discovery.mjs','utf8');assert.match(s,/handoffPerformed:false/);assert.doesNotMatch(s,/send_email\s*\(/);});
test('all five requested sources are explicit',()=>{const s=readFileSync('scripts/commercial/agent1_autonomous_discovery.mjs','utf8');for(const name of ['apollo','lusha','upwork','n8n','internet']) assert.ok(s.includes("'"+name+"'"));});
