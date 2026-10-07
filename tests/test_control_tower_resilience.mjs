import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script=fileURLToPath(new URL('../scripts/commercial/mit_daily_control_tower.mjs',import.meta.url));
test('daily control retains cohorts and costs when authenticated payment source is unavailable',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'boltech-resilience-'));
 const preload=`globalThis.fetch=async(url,options={})=>{
 const path=new URL(url).pathname;
 let data;
 if(path==='/api/telegram')data={status:'ONLINE'};
 else if(path==='/api/partners')data={success:true,metrics:{verifiedSales:null,cohorts:{'RSI-01':{total:5},'RSI-02':{total:1}},operatingCosts:{complete:true,totalCostUsd:10},a2a:{enabledPartners:0}}};
 else if(path.includes('contacts/search'))data={contacts:[]};
 else if(path.includes('emailer_campaigns/search'))data={emailer_campaigns:[]};
 else if(path.includes('hot-leads'))data={leads:[]};
 else throw new Error('Unexpected mock request');
 return {ok:true,status:200,json:async()=>data};};`;
 try{
 await new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),script],{cwd,env:{...process.env,APOLLO_API_KEY:'test',EXPLEE_API_KEY:'test',PARTNER_API_TOKEN:'test',GITHUB_STEP_SUMMARY:''},stdio:'ignore'});
 p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('Control runner failed')));
 });
 const r=JSON.parse(await readFile(join(cwd,'ops-output/commercial-report.json'),'utf8'));
 assert.equal(r.commercial.metrics.cohorts['RSI-02'].total,1);
 assert.equal(r.commercial.metrics.operatingCosts.totalCostUsd,10);
 assert.equal(r.commercial.architecture.goal,'WAITING_VERIFIED_CASH');
 assert.equal(r.commercial.progress.cashCollectedUsd,null);
 assert.equal(r.commercial.strategyActions[1].observedAccounts,1);
 }finally{await rm(cwd,{recursive:true,force:true});}
});
