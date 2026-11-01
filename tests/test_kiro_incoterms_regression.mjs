import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const ctx=readFileSync('lib/kiro_incoterms_context.js','utf8');const api=readFileSync('lib/specialist_chat.js','utf8');
test('Kiro receives scoped Incoterms guidance',()=>{assert.match(api,/type==='logistics'\?' '\+KIRO_INCOTERMS_CONTEXT/);assert.match(ctx,/Incoterms® 2020/);for(const term of ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'])assert.match(ctx,new RegExp('\\b'+term+'\\b'));});
test('Kiro distinguishes multimodal, risks and costs and cannot book',()=>{assert.match(ctx,/containerized and multimodal/);assert.match(ctx,/transfer of risk/);assert.match(ctx,/who books and pays/);assert.match(ctx,/Do not invent freight quotes or claim to book shipments/);});
