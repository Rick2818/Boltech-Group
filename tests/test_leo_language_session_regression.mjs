import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync('sales-agent.html','utf8');
const inline=[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);

test('Leo page JavaScript parses',()=>{
 assert.ok(inline.length,'Leo must have a browser script');
 for(const script of inline)new Script(script);
});

test('language selection does not reset conversation or discard pending objective',()=>{
 assert.match(html,/function updateLanguageControls\(/);
 assert.match(html,/language=language==='es'\?'en':'es';updateLanguageControls\(\)/);
 const handler=html.match(/document\.getElementById\('lang'\)\.onclick=\(\)=>\{([^\n]+)\};/);
 assert.ok(handler,'language control must have its own handler');
 assert.doesNotMatch(handler[1],/start\(/);
 assert.doesNotMatch(handler[1],/history\s*=|pendingObjective\s*=|replaceChildren\(/);
 assert.match(handler[1],/chat\.children\.length===1/);
});

test('Leo voice and mic adapt to the selected language',()=>{
 assert.match(html,/leo_speech=1/);
 assert.match(html,/X-Boltech-Voice-Id/);
 assert.match(html,/es-SV-RodrigoNeural/);
 assert.match(html,/language==='es'/);
 assert.match(html,/const player=new Audio\(\)/);
 assert.match(html,/player\.src=objectUrl/);
 assert.match(html,/await player\.play\(\)/);
 assert.match(html,/listening\|\|busy\|\|playing/);
 assert.match(html,/player\.onended=\(\)=>\{stopLeoSpeech\(\);scheduleListening\(\);\}/);
 assert.match(html,/recognition\.lang=language==='es'\?'es-SV':'en-US'/);
 assert.match(html,/requestSubmit\(\)/);
 assert.match(html,/🔊 Voice/);
});
