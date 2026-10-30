import test from 'node:test';
import assert from 'node:assert/strict';
import {executeLeoDecision,executeLeoReadTool,parseLeoToolDecision} from '../lib/leo_public_tools.js';

test('model selected tool returns real receipt and redacted provider diagnosis',async()=>{
 const result=await executeLeoDecision('{"action":"read_tool","tool":"whatsapp_readiness"}',{statusProvider:()=>({configured:true,fromNumber:'secret'})});
 assert.equal(result.ok,true);
 assert.equal(result.tool,'whatsapp_readiness');
 assert.equal(result.data.ownerAuthorizationVerified,false);
 assert.equal(result.data.messageSent,false);
 assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('unknown or write tools are never dispatched',async()=>{
 for(const tool of ['send_whatsapp','charge_wompi','send_email','__proto__'])assert.equal(parseLeoToolDecision(JSON.stringify({action:'read_tool',tool})),null);
 await assert.rejects(executeLeoReadTool('send_whatsapp'),/LEO_TOOL_NOT_ALLOWED/);
});
test('catalog includes approved prices with no payment side effects',async()=>{
 const result=await executeLeoDecision('{"action":"read_tool","tool":"catalog"}');
 assert.equal(result.data.pilotUSD,600);
 assert.equal(result.data.customFromUSD,900);
 assert.equal(result.data.quotationRequired,true);
});
test('invalid model output cannot execute a tool',async()=>{
 assert.equal(await executeLeoDecision('I sent an email'),null);
 assert.equal(await executeLeoDecision('{"action":"none"}'),null);
});
