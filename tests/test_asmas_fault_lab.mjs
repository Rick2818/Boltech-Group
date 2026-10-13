import test from 'node:test';import assert from 'node:assert/strict';import {runFaultLab} from '../asmas/fault-lab.mjs';
test('offline fault lab reports only honest evidence and never claims production',()=>{
 const x=runFaultLab();
 assert.equal(x.failed,0);assert.equal(x.passed,8);assert.equal(x.not_implemented,7);assert.equal(x.certified,false);
 assert.equal(x.environment,'OFFLINE_SIMULATION');
});
