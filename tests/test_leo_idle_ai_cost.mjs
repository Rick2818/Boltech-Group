import test from 'node:test';
import assert from 'node:assert/strict';
import {respondAsLeo,leoReadToolLikelyUseful} from '../lib/leo_sales_runtime.js';

test('low-cost classifier does not trigger verified tools for ordinary conversation', () => {
  for (const text of ['Hola', 'Hello!', 'Necesito mejorar mi proceso.', 'How much does a pilot cost?']) {
    assert.equal(leoReadToolLikelyUseful(text), false, text);
  }
  for (const text of ['Quiero ver el catálogo', 'What agents are available?', 'WhatsApp readiness']) {
    assert.equal(leoReadToolLikelyUseful(text), true, text);
  }
});

test('ordinary chat invokes a single LLM generation and never a read tool', async () => {
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-only-not-a-real-key';
  try {
    let generations=0, tools=0;
    const result=await respondAsLeo({message:'Hola, quiero automatizar mi negocio.'},{
      generate:async()=>{generations++;return {text:'Claro, ¿qué proceso querés automatizar?'}},
      executeReadTool:async()=>{tools++;throw Error('Read tool should not run')}
    });
    assert.equal(result.mode,'AI_CONSULTATIVE');
    assert.equal(generations,1);
    assert.equal(tools,0);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});

test('explicit catalog question preserves verified read-only tool and receipt', async () => {
  const oldKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='synthetic-only-not-a-real-key';
  try {
    let generations=0, tools=0;
    const result=await respondAsLeo({message:'¿Qué agentes aparecen en el catálogo?'},{
      generate:async()=>{generations++;return {text:generations===1?'Te presento nuestros agentes.':'{"action":"read_tool","tool":"catalog"}'}},
      executeReadTool:async()=>{tools++;return {ok:true,tool:'catalog',receipt:'qa-catalog-verified',data:{products:3}}}
    });
    assert.equal(generations,2);
    assert.equal(tools,1);
    assert.equal(result.mode,'AI_WITH_VERIFIED_TOOL');
    assert.equal(result.toolReceipt,'qa-catalog-verified');
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY=oldKey;
  }
});
