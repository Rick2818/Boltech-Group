import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('discovery produces no implicit outbound or purchase commands',()=>{const s=readFileSync('scripts/commercial/agent1_autonomous_discovery.mjs','utf8');assert.match(s,/handoffPerformed:false/);assert.doesNotMatch(s,/send_email\s*\(/);});
test('discovery sources include the public n8n community jobs board',()=>{const s=readFileSync('scripts/commercial/agent1_autonomous_discovery.mjs','utf8');for(const name of ['apollo','lusha','upwork','internet']) assert.ok(s.includes("'"+name+"'"));assert.match(s,/sources\.n8nCommunityJobs=/);});
test('freelance opportunities stay separate from buyer qualification and outbound actions',()=>{const s=readFileSync('scripts/commercial/agent1_autonomous_discovery.mjs','utf8');assert.match(s,/freelanceOpportunities/);assert.match(s,/proposalsSubmitted:false/);assert.match(s,/externalMessagesSent:false/);assert.match(s,/connectsUsed:0/);});
