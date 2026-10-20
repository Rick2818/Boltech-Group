import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
test('harness commercial documentation has single current Agent 1 V2 reference',async()=>{
 const text=await readFile('docs/architecture/COMMERCIAL_HARNESS.md','utf8');
 assert.match(text,/Agente 1 V2/);
 assert.match(text,/exactamente cinco leads completos y verificados/);
 assert.match(text,/Recursive Self-Improvement/);
 assert.match(text,/Explee/);
 assert.match(text,/producción no certificada/);
 await assert.rejects(access('docs/HARNESS_AGENT1_DISCOVERY_2026-10-18.md'));
});
test('cross-agent delivery harness and autodoc remain available',async()=>{
 await access('docs/architecture/HARNESS_WORKFLOW.md');
 await access('docs/architecture/HARNESS_AUTODOC.md');
 await access('docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md');
});
