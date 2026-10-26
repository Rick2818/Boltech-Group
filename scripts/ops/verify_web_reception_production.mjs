import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import qaCase from '../../config/qa_case.json' with {type:'json'};
// Deliberately synthetic and marked QA by the receiver; no email or payment is sent.
await mkdir('ops-output',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage({viewport:{width:1365,height:900}});
  await page.goto('https://boltech-group.vercel.app/',{waitUntil:'domcontentloaded'});
  await page.locator('.reception-launch').click();
  const values=qaCase.answers;
  let payload;
  page.on('request',request=>{if(request.url().endsWith('/api/lead'))payload=request.postDataJSON();});
  for(let i=0;i<values.length;i++){
    await page.locator('#reception-answer').fill(values[i]);
    if(i===values.length-1)await page.locator('.reception-consent input').check();
    const response=i===values.length-1?page.waitForResponse(r=>r.url().endsWith('/api/lead'),{timeout:90000}):null;
    await page.locator('.reception-form>button').click();
    if(response){
      const received=await response,data=await received.json();
      const report={at:new Date().toISOString(),source:'Browser → production /api/lead → existing CRM and RSI Agent Work readback',synthetic:true,status:received.status(),response:data};
      await writeFile('ops-output/web-reception-production-verification.json',JSON.stringify(report,null,2));
      assert.equal(received.status(),200,JSON.stringify(data));assert.ok(['RSI-01','RSI-02','RSI-03'].includes(data.assignment?.owner));assert.equal(data.registration?.status,'RECORDED');
      assert.equal(data.registration.requestId,qaCase.requestId);
      const duplicate=await page.request.post('https://boltech-group.vercel.app/api/lead',{data:payload});
      const replay=await duplicate.json();assert.equal(duplicate.status(),200);assert.equal(replay.registration?.requestId,data.registration.requestId);
      await page.locator('.reception-status').filter({hasText:/Solicitud registrada\.|Request registered\./}).waitFor();
      await page.screenshot({path:'ops-output/web-reception-production.png'});
      report.duplicateReferenceConfirmed=true;report.status='PASS';
      await writeFile('ops-output/web-reception-production-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    }
  }
}finally{await browser.close();}
