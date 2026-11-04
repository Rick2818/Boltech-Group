import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

function assertScriptSyntax(file){
 const html=readFileSync(file,'utf8');
 const script=html.match(/<script(?:[^>]*)>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Missing inline JavaScript in '+file);
 new Script(script);
 return html;
}

test('Leo uses Salvadoran Rodrigo voice without browser fallback',()=>{
 const html=assertScriptSyntax('sales-agent.html');
 assert.match(html,/rodrigo_speech=1/);
 assert.doesNotMatch(html,/maria_speech=1/);
 assert.match(html,/Preparando voz de Rodrigo/);
 assert.match(html,/Rodrigo Azure no disponible/);
 assert.match(html,/id="voice-test"/);
 assert.match(html,/X-Boltech-Voice-Id/);
 assert.match(html,/VOICE_MISMATCH/);
 assert.match(html,/Desde sus seis años mostró talento para la música/);
 assert.doesNotMatch(html,/es_MX-claude-high|diffusionstudio\/vits-web/);
 assert.doesNotMatch(html,/loadLeoVoice\(\);|loadMexicanVoice\(\);/);
});

test('Other specialist agents retain Maria voice',()=>{
 const html=assertScriptSyntax('specialist.html');
 assert.match(html,/maria_speech=1/);
 assert.match(html,/Preparando voz de María/);
 assert.doesNotMatch(html,/rodrigo_speech=1/);
});

test('Server routes both speech voices',()=>{
 const api=readFileSync('api/index.js','utf8');
 assert.match(api,/get\('rodrigo_speech'\)/);
 assert.match(api,/get\('maria_speech'\)/);
});

test('Azure Spanish voices stay allowlisted, server-side and fail-closed',()=>{
 const src=readFileSync('lib/maria_speech_http.js','utf8');
 assert.match(src,/AZURE_SPEECH_F0_CONFIRMED!=='true'/);
 assert.match(src,/es-SV-RodrigoNeural/);
 assert.match(src,/X-Boltech-Voice-Id/);
 assert.match(src,/Content-Language/);
 assert.match(src,/es-CR-MariaNeural/);
 assert.match(src,/isRodrigo\?'es-SV':'es-CR'/);
 assert.match(src,/isRodrigo\?'es-SV-RodrigoNeural':'es-CR-MariaNeural'/);
 assert.match(src,/MAX_REQUEST_CHARS=300/);
 assert.match(src,/redis.eval\(SCRIPT/);
 assert.match(src,/QUOTA_STORE_UNAVAILABLE/);
 assert.match(src,/MAX_MONTHLY_CHARS=100000/);
 assert.match(src,/boltech:maria:tts:chars:/);
 assert.doesNotMatch(readFileSync('sales-agent.html','utf8')+readFileSync('specialist.html','utf8'),/AZURE_SPEECH_KEY/);
});
