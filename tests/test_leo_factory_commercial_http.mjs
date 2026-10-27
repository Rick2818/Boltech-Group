import test from 'node:test';
import assert from 'node:assert/strict';
import {handleLeoFactoryCommercial} from '../lib/leo_factory_commercial_http.js';
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(o){this.payload=o;return this}}}
test('rejects missing tenant authentication and does not touch data storage',async()=>{
 const res=response();
 await handleLeoFactoryCommercial({method:'POST',headers:{},body:{operation:'list_opportunities'}},res,{
   verify:()=>{throw Object.assign(Error('LEO_AUTH_UNVERIFIED'),{statusCode:401})},
   clientFactory:()=>{throw Error('MUST_NOT_CONNECT')}
 });
 assert.equal(res.statusCode,401);assert.equal(res.payload.error,'LEO_AUTH_UNVERIFIED');
});
test('rejects large requests before identity handling',async()=>{
 const res=response();
 await handleLeoFactoryCommercial({method:'POST',headers:{'content-length':'15000'}},res,{verify:()=>{throw Error('MUST_NOT_RUN')}});
 assert.equal(res.statusCode,413);
});
test('never enables unconfigured commercial storage',async()=>{
 const res=response();
 await handleLeoFactoryCommercial({method:'POST',headers:{authorization:'Bearer synthetic'},body:{operation:'list_opportunities'}},res,{
  verify:()=>({verified:true,tenantId:'tenant-test',subject:'user-test'}),
  clientFactory:()=>{throw Error('MUST_NOT_CONNECT')}
 });
 assert.ok([400,503].includes(res.statusCode));
 assert.equal(res.payload.success,false);
});
