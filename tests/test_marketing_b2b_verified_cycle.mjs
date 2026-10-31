import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketingB2BVerifiedCycle} from '../lib/marketing_b2b_verified_cycle.js';

test('stops without verified research and never calls Gemini or Supabase',async()=>{
 let calls=0;
 const result=await runMarketingB2BVerifiedCycle({
  candidates:[{url:'https://unknown.example/a',title:'Unknown'}],
  allowedHosts:['approved.example'],
  researchFetcher:async()=>{calls++;throw Error('unexpected')},
  generate:async()=>{calls++;throw Error('unexpected')},
  dbFetcher:async()=>{calls++;throw Error('unexpected')}
 });
 assert.equal(result.status,'NO_VERIFIED_SOURCES');
 assert.equal(calls,0);
});
test('connects verified source, model generation and persisted receipt',async()=>{
 let writes=0;
 const result=await runMarketingB2BVerifiedCycle({
  candidates:[{url:'https://approved.example/report',title:'Report'}],
  allowedHosts:['approved.example'],
  researchFetcher:async()=>({ok:true,status:200,headers:{get:()=> 'text/plain'},text:async()=> 'Verified industry report '.repeat(20)}),
  generate:async()=>({text:JSON.stringify({
   subject:'Manufacturing operations',body:'Manufacturing workflow analysis '.repeat(30),
   industry:'Manufacturing',buyerRole:'Operations manager',businessProblem:'Manual order handling',
   proposedSolution:'Connect existing systems using APIs',kpis:['Time to quote'],language:'en'
  })}),
  env:{SUPABASE_URL:'https://supabase.example',SUPABASE_SERVICE_ROLE_KEY:'test-only'},
  dbFetcher:async(url,options)=>{
   if(options.method==='POST'){writes++;return {ok:true,status:201}}
   const id=new URL(url).searchParams.get('id').slice(3);
   return {ok:true,json:async()=>[{id,distribution_status:'REVIEW_REQUIRED'}]};
  }
 });
 assert.equal(result.status,'PERSISTED_FOR_REVIEW');
 assert.equal(result.verifiedSources,1);
 assert.equal(writes,1);
 assert.equal(result.published,false);
});
