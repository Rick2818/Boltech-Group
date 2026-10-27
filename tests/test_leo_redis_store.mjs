import test from 'node:test';import assert from 'node:assert/strict';
import {createLeoRedisStore} from '../lib/leo_redis_store.js';import {createLeoTenantAgent} from '../lib/leo_tenant_autonomy.js';
function harness(){
 const mem=new Map(),command=async a=>{
 if(a[0]==='GET')return mem.get(a[1])??null;
 if(a[0]!=='EVAL')throw Error('unexpected');
 const key=a[3],value=mem.get(key);
 if(a[1].includes("'EXISTS'")){if(value)return 'CONFLICT';mem.set(key,a[4]);return 'OK'}
 if(!value)return 'MISSING';
 if(JSON.parse(value).version!==Number(a[4]))return 'CONFLICT';
 mem.set(key,a[5]);return 'OK';
 };
 const store=createLeoRedisStore(command),agent=(tenant,subject='client')=>createLeoTenantAgent({store,principal:{verified:true,tenantId:tenant,subject,roles:['tenant_operator']}});
 return {mem,store,agent};
}
const spec={id:'sale_goal_01',description:'Qualify incoming B2B requests correctly',criteria:'Qualified contacts with evidence'};
test('redis persistence survives newly constructed Leo instances',async()=>{
 const h=harness();let r=await h.agent('tenant_boltech').objective(spec);
 const other=h.agent('tenant_boltech');
 assert.equal((await other.get(spec.id)).version,1);
 r=await other.transition({id:spec.id,expectedVersion:1,action:'plan',eventId:'plan_1',plan:['Review publicly verified customer request']});
 assert.equal((await h.agent('tenant_boltech').get(spec.id)).version,2);
});
test('tenant isolation holds at Redis key level and rejects cross-tenant writes',async()=>{
 const h=harness();await h.agent('tenant_boltech').objective(spec);
 assert.equal(await h.agent('tenant_other').get(spec.id),null);
 await assert.rejects(h.store.writeIfVersion('leo:v1:tenant_other:sale_goal_01',null,{tenantId:'tenant_boltech',id:'sale_goal_01'}),{code:'LEO_STORE_TENANT_MISMATCH'});
});
test('idempotency and conflicting CAS recover without double mutation',async()=>{
 const h=harness(),a=h.agent('tenant_boltech');await a.objective(spec);
 const two=await Promise.allSettled([a.transition({id:spec.id,expectedVersion:1,action:'plan',eventId:'evt_a',plan:['Review sales documents']}),a.transition({id:spec.id,expectedVersion:1,action:'plan',eventId:'evt_b',plan:['Review sales documents']})]);
 assert.equal(two.filter(x=>x.status==='fulfilled').length,1);
 assert.equal((await a.get(spec.id)).version,2);
});
test('storage errors fail closed rather than retaining volatile state',async()=>{
 const store=createLeoRedisStore(async()=>{throw Error('redis offline')});
 await assert.rejects(store.read('leo:v1:tenant_boltech:sale_goal_01'),/redis offline/);
});
