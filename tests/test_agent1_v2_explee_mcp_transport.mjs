import test from 'node:test';
import assert from 'node:assert/strict';
import {probeExpleeMcp,discoverExpleeWithMcp} from '../lib/agent1_v2_explee_mcp_transport.js';
test('Explee MCP missing key fails closed',async()=>{assert.equal((await probeExpleeMcp({env:{}})).code,'EXPLEE_API_KEY_REQUIRED');});
test('Explee MCP tool discovery uses official search and no send',async()=>{
 let closed=false,called=false;
 const factory=async()=>({listTools:async()=>({tools:[{name:'search_companies'}]}),callTool:async({name,arguments:args})=>{called=true;assert.equal(name,'search_companies');assert.deepEqual(args.geo_include,['US']);return {content:[{type:'text',text:JSON.stringify({companies:[{id:'1',name:'Test Co',country:'US'}]})}]};},close:async()=>{closed=true;}});
 const p=await probeExpleeMcp({env:{EXPLEE_API_KEY:'synthetic'},clientFactory:factory});assert.equal(p.status,'CONNECTED');
 const rows=await discoverExpleeWithMcp({env:{EXPLEE_API_KEY:'synthetic'},clientFactory:factory,allowSearch:true});
 assert.equal(rows.length,1);assert.equal(rows[0].buyerVerified,false);assert.equal(rows[0].sendAllowed,false);assert.equal(called,true);assert.equal(closed,true);
});
test('no costly search without budget authorization',async()=>{await assert.rejects(discoverExpleeWithMcp({env:{EXPLEE_API_KEY:'synthetic'}}),/BUDGET_APPROVAL_REQUIRED/);});
