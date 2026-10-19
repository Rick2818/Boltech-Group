import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const workflow=readFileSync('.github/workflows/asmas_rsi01_9am.yml','utf8');
test('central morning coordinator researches before five-lead gate, then dispatches',()=>{
 const research=workflow.indexOf('name: Research independent platforms'),prepare=workflow.indexOf('name: Prepare exactly five'),send=workflow.indexOf('name: Execute daily RSI-01');
 assert.ok(research>0&&prepare>research&&send>prepare);assert.match(workflow.slice(send,workflow.indexOf('env:',send)),/success\(\)/);
});
test('preparation starts at 08 SV; old 09:15 discovery scheduler cannot compete',()=>{
 assert.match(workflow,/cron: '0,15,30,45 14 \* \* 1-5'/);assert.match(workflow,/github\.event\.schedule != '0,15,30,45 14 \* \* 1-5'/);
 const separate=readFileSync('.github/workflows/agent1_autonomous_discovery.yml','utf8');assert.doesNotMatch(separate,/^  schedule:/m);assert.match(separate,/workflow_dispatch:/);
});
