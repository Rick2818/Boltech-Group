import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpleeMcpSource} from '../lib/agent1_v2_explee_mcp.js';
import {createAgent1LeadSources} from '../lib/agent1_v2_lead_sources.js';
test('MCP is blocked without connection and explicit budget permission',async()=>{
 assert.throws(()=>createExpleeMcpSource(),/CONNECTION_REQUIRED/);
 const x=createExpleeMcpSource({callTool:async()=>{throw Error('unexpected');}});
 const result=await createAgent1LeadSources({expleeMcpConfig:{callTool:async()=>{throw Error('unexpected');}}}).discover();
 assert.equal(result.sources[2].status,'CONNECTOR_UNAVAILABLE');
 await assert.rejects(x(),/NOT_AUTHORIZED/);
});
test('MCP search uses official tool and preserves no-send gate',async()=>{
 let calls=0;
 const sources=createAgent1LeadSources({expleeMcpConfig:{allowSearch:true,availableTools:['search_companies'],callTool:async(name,args)=>{
  calls++;assert.equal(name,'search_companies');assert.deepEqual(args.geo_include,['US']);
  return {content:[{type:'text',text:JSON.stringify({companies:[{id:'qa-1',name:'Synthetic US Co',country:'US',website:'https://example.test'}]})}]};
 }}});
 const r=await sources.discover();
 assert.equal(calls,1);assert.equal(r.sources[2].status,'OBSERVED');
 assert.equal(r.sources[2].candidates[0].contactVerified,false);
 assert.equal(r.sources[2].candidates[0].sendAllowed,false);
 assert.equal(r.sendAllowed,false);
});
test('MCP error does not silently fall back to stale Explee data',async()=>{
 const r=await createAgent1LeadSources({expleeMcpConfig:{allowSearch:true,callTool:async()=>({isError:true})}}).discover();
 assert.equal(r.sources[2].status,'CONNECTOR_UNAVAILABLE');assert.equal(r.sources[2].candidates.length,0);
});
