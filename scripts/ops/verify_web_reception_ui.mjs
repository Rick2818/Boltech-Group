import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.RECEPTION_PREVIEW_URL||'http://127.0.0.1:4178';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
try{
  for(const viewport of [{width:1365,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // UI contract only: no customer, CRM mutation, email, model call or payment.
    let payload,attempts=0;
    await page.route('**/api/lead',async route=>{
      attempts++;payload=route.request().postDataJSON();
      await route.fulfill({status:attempts===1?503:200,contentType:'application/json',body:JSON.stringify(attempts===1
        ? {success:false,error:'CRM temporalmente no disponible.'}
        : {success:true,registration:{status:'RECORDED',requestId:'a'.repeat(64)},assignment:{owner:'RSI-01',status:'QUEUED'}})});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('.reception-launch').click();
    const answer=page.locator('#reception-answer'),next=page.locator('.reception-form>button');
    const values=['Perdemos consultas de clientes','Llegan por correo y se copian a mano','Dos horas al día','Correo y hojas de cálculo','Gerente aprueba los envíos','Asignar cada consulta esta semana','Nunca enviar sin aprobación','Empresa de prueba QA','qa@example.com'];
    for(let i=0;i<values.length;i++){
      await answer.fill(values[i]);
      if(i===values.length-1)await page.locator('.reception-consent input').check();
      await next.click();
      if(i===0)await page.getByText(/Podríamos ayudarte a registrar cada consulta/).waitFor();
    }
    await page.locator('.reception-status').filter({hasText:'CRM temporalmente'}).waitFor();
    assert.equal(await answer.inputValue(),'qa@example.com');
    await next.click();
    await page.locator('.reception-status').filter({hasText:'Solicitud registrada.'}).waitFor();
    assert.equal(payload.source,'RSI01_WEB');assert.equal(payload.impact,values[2]);assert.equal(payload.limits,values[6]);assert.equal(payload.consent,true);
    const box=await page.locator('#reception-panel').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=viewport.width);
    await mkdir('ops-output',{recursive:true});await page.screenshot({path:`ops-output/web-reception-${viewport.width}.png`});
    assert.deepEqual(errors,[]);
    results.push({viewport,status:'PASS',diagnosisQuestions:7,failedSubmissionRetained:true,retryVerified:true,backend:'SIMULATED'});await page.close();
  }
  await writeFile('ops-output/web-reception-ui-verification.json',JSON.stringify({at:new Date().toISOString(),results,productionVerified:false},null,2));
  console.log(JSON.stringify(results));
}finally{await browser.close();}
