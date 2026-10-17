import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
const source=readFileSync(new URL('../api/partners.js',import.meta.url),'utf8');
const section=source.split("if(action==='commercial-activation') {")[1].split("if(action==='marketing-maintenance') {")[0];
test('one daily Hobby cron is configured for existing commercial handler',()=>{assert.deepEqual(vercel.crons,[{path:'/api/partners?action=commercial-activation&run=1',schedule:'0 15 * * *'}]);});
test('cron must authenticate with timing safe production secret',()=>{assert.match(section,/process\.env\.CRON_SECRET/);assert.match(section,/crypto\.timingSafeEqual/);assert.match(section,/CRON_AUTH_REQUIRED/);});
test('cron only manages pending marketing and does not send prospect mail',()=>{assert.match(section,/cycle\('MARKETING'\)/);assert.doesNotMatch(section,/gmail\.send|sdr-send|createSdrDispatch/);});
test('customer inbox executes even when commercial queues are unavailable',async()=>{
 const calls=[];
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const run=new AsyncFunction('req','res','requireOperationalAuth','createInteragentCoordinator','createRsiMarketingCycle','createRsi02InboxExecutor','createDailyLeadExecutor','json','marketingErrorCode','crypto',section.trim().replace(/\}\s*$/,''));
 const response=await run({method:'POST',query:{}},{},()=>true,
  ()=>({queue:async()=>{calls.push('queue');throw Error('QUEUE_DOWN');}}),
  worker=>async role=>worker.queue(role),
  ()=>({run:async()=>{calls.push('inbox');return {success:true};}}),
  ()=>({run:async()=>({})}),(_res,status,body)=>({status,body}),()=> 'QUEUE_DOWN',{});
 assert.equal(calls[0],'inbox');
 assert.equal(response.status,503);
});
