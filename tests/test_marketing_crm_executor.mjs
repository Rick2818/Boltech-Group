import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarketingCrmExecutor} from '../lib/marketing_crm_executor.js';
const lead={company:'Sample Manufacturer',email:'SALES@SAMPLE.EXAMPLE',source:'Apollo',sourceUrl:'https://example.com/a',contact:'Sales',country:'United States'};
function client(mode='new'){
 let calls=[],id='recABCDEFGHIJKLMNOP'.slice(0,17);
 let createdEmail='sales@sample.example';
 const fetcher=async(url,opts={})=>{
   const u=new URL(url),verb=opts.method||'GET';calls.push({url:String(url),verb,body:opts.body?JSON.parse(opts.body):null});
   if(verb==='POST'){createdEmail=opts.body?JSON.parse(opts.body).fields.fldoJrBeutRTd85II||'':'';return {ok:true,json:async()=>({id})};}
   if(u.pathname.endsWith('/'+id))return {ok:true,json:async()=>({id,fields:{Name:'Sample Manufacturer','Contact Email':createdEmail}})};
   return {ok:true,json:async()=>({records:mode==='duplicate'?[{id}]:[]})};
 };
 return {calls,worker:createMarketingCrmExecutor({fetcher,env:{AIRTABLE_TOKEN:'mock-only'}})};
}
test('realistic marketing intake creates once, verifies and never sends email',async()=>{
 const c=client();const r=await c.worker.intake(lead);
 assert.equal(r.created,true);assert.equal(r.sendingAllowed,false);assert.equal(c.calls.filter(x=>x.verb==='POST').length,1);
 const fields=c.calls.find(x=>x.verb==='POST').body.fields;
 assert.equal(fields.fldoJrBeutRTd85II,'sales@sample.example');assert.equal(fields.fldOUhgJXDu1a8wqE,'RESEARCH_ONLY');
 assert.equal(c.calls.length,3);
});
test('existing record is reused without duplicate creation',async()=>{
 const c=client('duplicate');const r=await c.worker.intake(lead);
 assert.equal(r.duplicate,true);assert.equal(c.calls.filter(x=>x.verb==='POST').length,0);
});
test('Upwork lead requires platform-only channel, no off-platform email',async()=>{
 const c=client();
 await assert.rejects(()=>c.worker.intake({...lead,source:'Upwork'}),{code:'MARKETING_CRM_UPWORK_OFF_PLATFORM_BLOCKED'});
 const r=await c.worker.intake({...lead,source:'Upwork',email:''});
 assert.equal(r.created,true);assert.equal(c.calls.filter(x=>x.verb==='POST').length,1);
 assert.match(c.calls[0].url,/Source\+Evidence\+URL/);
});
test('missing credentials and invalid source fail closed',async()=>{
 await assert.rejects(()=>createMarketingCrmExecutor({env:{},fetcher:()=>{throw Error('must not')}}).intake(lead),{code:'MARKETING_CRM_NOT_CONFIGURED'});
 const c=client();await assert.rejects(()=>c.worker.intake({...lead,source:'unknown'}),{code:'MARKETING_CRM_INVALID_SOURCE'});
 assert.equal(c.calls.length,0);
});
test('unverified read-after-write receipt never reports success',async()=>{
 const fetcher=async(url,opts={})=>({ok:true,json:async()=>opts.method==='POST'?{id:'recABCDEFGHIJKLMNOP'.slice(0,17)}:new URL(url).pathname.endsWith('/recABCDEFGHIJKLMN')?{id:'recABCDEFGHIJKLMN',fields:{Name:'WRONG'}}:{records:[]}});
 await assert.rejects(()=>createMarketingCrmExecutor({fetcher,env:{AIRTABLE_TOKEN:'mock'}}).intake(lead),{code:'MARKETING_CRM_VERIFY_FAILED'});
});

test('Marstrand real CRM record resolves to original ID without new contact or resend',async()=>{
 const id='rec1SpCPYLPFbhK8L',calls=[];
 const fetcher=async(url,opts={})=>{
   calls.push({url:String(url),method:opts.method||'GET'});
   if(opts.method==='POST')throw Error('Duplicate write must never occur');
   return {ok:true,json:async()=>({records:[{id,fields:{Name:'Marstrand Industries','Contact Email':'sales@marstrand.us'}}]})};
 };
 const r=await createMarketingCrmExecutor({fetcher,env:{AIRTABLE_TOKEN:'mock'}}).intake({company:'Marstrand Industries',email:'sales@marstrand.us',source:'Website',sourceUrl:'https://marstrand.us/contact/'});
 assert.deepEqual({recordId:r.recordId,created:r.created,duplicate:r.duplicate,sendingAllowed:r.sendingAllowed},
   {recordId:id,created:false,duplicate:true,sendingAllowed:false});
 assert.equal(calls.length,1);
});
