import test from 'node:test';import assert from 'node:assert/strict';
import {createAgents} from '../asmas/sdk-runtime.mjs';
test('SDK factory maps exactly five agents without network',async()=>{
 class Agent{constructor(x){this.config=x}}
 const {agents}=await createAgents({sdkLoader:async()=>({Agent,run:async()=>({finalOutput:'fake'})})});
 assert.equal(Object.keys(agents).length,5);
 assert.match(agents.A4.config.instructions,/orchestrator|Director/i);
});
