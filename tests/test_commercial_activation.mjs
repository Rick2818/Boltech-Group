import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import partnersHandler from '../api/partners.js';

const source=readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
async function invoke(method='GET',authorized=true){
 const existing=process.env.PARTNER_API_TOKEN;
 process.env.PARTNER_API_TOKEN='synthetic-retirement-test';
 const req={method,url:'/api/partners?action=commercial-activation',headers:authorized?{authorization:'Bearer synthetic-retirement-test'}:{},body:{}};
 const res={statusCode:200,payload:null,setHeader(){return this;},status(n){this.statusCode=n;return this;},json(o){this.payload=o;return this;}};
 try{return await partnersHandler(req,res),res;}
 finally{if(existing===undefined)delete process.env.PARTNER_API_TOKEN;else process.env.PARTNER_API_TOKEN=existing;}
}

test('commercial activation remains explicitly retired instead of registered as an executor',()=>{
 assert.match(source,/['"]commercial-activation['"]/);
 assert.doesNotMatch(source,/if\s*\(\s*action\s*===\s*['"]commercial-activation['"]\s*\)/);
 assert.doesNotMatch(source,/createRsi01DailyWorker|createSdrDispatch|runApprovedCampaign/);
});
test('retired activation fails closed for authorized GET and POST',async()=>{
 for(const method of ['GET','POST']){
  const r=await invoke(method);
  assert.equal(r.statusCode,410);
  assert.equal(r.payload.code,'LEGACY_COMMERCIAL_TRACTION_RETIRED');
  assert.equal(r.payload.sendingEnabled,false);
  assert.equal(r.payload.strategy,'UPWORK_FREELANCER_ONLY');
 }
});
test('retired activation still requires operational authorization',async()=>{
 const r=await invoke('POST',false);
 assert.equal(r.statusCode,401);
});
test('customer initiated order and marketplace status remain separate from retired activation',()=>{
 assert.match(source,/if\(action==='client-order'\)/);
 assert.match(source,/if\(action==='commercial-engine-status'\)/);
});
