import test from 'node:test';
import assert from 'node:assert/strict';
import {createSalesAgentV2,qualifyProspect,campaignDate,prospectKey} from '../lib/agent1_v2_core.js';
const lead={company:'Example Inc',country:'US',email:'sales@example.com',officialWebsite:'https://example.com',sourceUrl:'https://example.com/contact',publishedBusinessContact:true,mxVerified:true,humanVerified:true};
const history={gmail:'CLEAR',crm:'CLEAR',suppression:'CLEAR'};
function memoryLedger(){
 const rows=new Map();
 return {
 read:async key=>rows.get(key),
 insertIfAbsent:async(key,row)=>{if(!rows.has(key))rows.set(key,row);},
 updateIfState:async(key,state,patch)=>{if(rows.get(key)?.state!==state)return false;rows.set(key,{...rows.get(key),...patch});return true;},
 reserveProspectAtomically:async({key,globalKey,day,recipient,cap})=>{
  if(rows.has(globalKey))return {reserved:false,state:'BLOCKED',reason:'CROSS_DAY_HISTORY_RECONCILIATION_REQUIRED'};
  const used=[...rows.values()].filter(x=>x.day===day&&['RESERVED','SENT','UNKNOWN'].includes(x.state)).length;
  if(used>=cap)return {reserved:false,state:'BLOCKED',reason:'DAILY_CAP_REACHED'};
  if(rows.has(key))return {reserved:false,state:rows.get(key).state,reason:'ALREADY_RESERVED'};
  rows.set(globalKey,{state:'SEEN',day});
  rows.set(key,{day,state:'RESERVED',recipient});
  return {reserved:true};
 }
 };
}
const args={prospect:lead,history,message:{subject:'Relevant inquiry',body:'Hello team'}};
const at=()=> '2026-10-20T15:00:00Z';
test('validation rejects unverified, suppression and synthetic',()=>{
 assert.equal(qualifyProspect(lead,history).eligible,true);
 assert.equal(qualifyProspect({...lead,suppressed:true},history).eligible,false);
 assert.equal(qualifyProspect({...lead,synthetic:true},history).eligible,false);
 assert.equal(qualifyProspect(lead,{...history,gmail:'UNKNOWN'}).eligible,false);
});
test('first send gets receipt and repeat is not sent',async()=>{
 let sent=0;const agent=createSalesAgentV2({ledger:memoryLedger(),clock:at,sender:{send:async()=>({messageId:'m'+(++sent)})}});
 assert.equal((await agent.dispatch(args)).state,'SENT');
 assert.equal((await agent.dispatch(args)).reused,true);
 assert.equal(sent,1);
});
test('ambiguous provider failure stays UNKNOWN and never resends',async()=>{
 let sent=0;const agent=createSalesAgentV2({ledger:memoryLedger(),clock:at,sender:{send:async()=>{sent++;throw Error('timeout');}}});
 assert.equal((await agent.dispatch(args)).state,'UNKNOWN');
 assert.equal((await agent.dispatch(args)).state,'UNKNOWN');
 assert.equal(sent,1);
});
test('daily cap is five',async()=>{
 let sent=0;const agent=createSalesAgentV2({ledger:memoryLedger(),clock:at,sender:{send:async()=>({messageId:String(++sent)})}});
 for(let i=0;i<6;i++)await agent.dispatch({...args,prospect:{...lead,email:'sales'+i+'@example.com'}});
 assert.equal(sent,5);
});
test('date and dedupe key are deterministic',()=>{
 assert.equal(campaignDate('2026-10-20T04:00:00Z'),'2026-10-19');
 assert.equal(prospectKey('2026-10-20','A@B.COM'),prospectKey('2026-10-20','a@b.com'));
});

test('same recipient held across different campaign dates',async()=>{
 let now='2026-10-20T15:00:00Z',sent=0;
 const agent=createSalesAgentV2({ledger:memoryLedger(),clock:()=>now,sender:{send:async()=>({messageId:String(++sent)})}});
 assert.equal((await agent.dispatch(args)).state,'SENT');
 now='2026-10-21T15:00:00Z';
 const repeat=await agent.dispatch(args);
 assert.equal(repeat.state,'BLOCKED');
 assert.equal(repeat.reason,'CROSS_DAY_HISTORY_RECONCILIATION_REQUIRED');
 assert.equal(sent,1);
});
