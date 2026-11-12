// Local-only rehearsal: real repository functions plus explicitly scripted
// commercial fixtures where no verified Leo production executor exists.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import worker,{EXPLEE_TARGET_COUNTRIES} from '../../cloudflare/pages-leo-audio-worker.mjs';
import {salesReply} from '../../lib/sales_dot_pilot.js';
import {validateCustomerOnboarding} from '../../lib/customer_onboarding.js';
import {PDRO_TEST_BUSINESS} from '../../lib/pdro_test_business.js';
import {runAcceptance} from './pdro_imports_sandbox.mjs';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const output=join(root,'ops-output','pdro-commercial');await mkdir(output,{recursive:true});
const steps=[];let externalNetworkAttempts=0;const requests=[],receipts=[];
const originalFetch=globalThis.fetch;
const add=(stage,mechanism,evidence)=>steps.push({stage,status:'PASS_IN_SYNTHETIC_REHEARSAL',mechanism,evidence});
const countries={SV:'El Salvador',GT:'Guatemala',PA:'Panamá',CO:'Colombia',MX:'México',US:'Estados Unidos'};
const env={LEO_PLATFORM_TOKEN:'synthetic-owner-token-never-production',EXPLEE_API_KEY:'synthetic-explee-only',FREELANCER_OAUTH_TOKEN:'synthetic-freelancer-only',FREELANCER_API_ENABLED:'true',COMMERCE:{get:async()=>null,put:async(key,value)=>receipts.push({key,value:JSON.parse(value)})}};
globalThis.fetch=async(url,init)=>{
 const target=new URL(typeof url==='string'?url:url.url);
 if(target.hostname==='127.0.0.1')return originalFetch(url,init);
 // In-process responses only. Never call a live platform with fictional data.
 if(target.href==='https://api.explee.com/public/api/v1/search/companies'){
  const body=JSON.parse(init.body);requests.push({platform:'explee',body});
  assert.deepEqual(body.filters.geo_include,Object.keys(countries));
  assert.equal(body.filters.geo_include_empty,false);assert.equal(body.page,1);assert.equal(body.page_size,10);
  return Response.json({companies:Object.keys(countries).map(country=>({name:country==='SV'?'SYN Pdro Imports':'SYN Distributor '+country,domain:country==='SV'?'pdro.example.test':country.toLowerCase()+'.example.test',country})),meta:{credits_charged:0}});
 }
 if(target.hostname==='www.freelancer.com'&&target.pathname==='/api/projects/0.1/projects/active/'){
  requests.push({platform:'freelancer',query:target.searchParams.get('query')});
  assert.equal(target.searchParams.get('limit'),'10');
  return Response.json({result:{projects:[{id:'SYN_PDRO_PROJECT',title:'SYN Pdro Imports: WhatsApp product assistant',seo_url:'automation/SYN-Pdro-Imports',budget:{minimum:0,maximum:0},currency:{code:'USD'}}]}});
 }
 externalNetworkAttempts++;throw Error('EXTERNAL_NETWORK_FORBIDDEN_IN_REHEARSAL');
};
try{
 const qa=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/test_leo_provider_diagnostics.mjs','tests/test_explee_target_geography.mjs'],{cwd:root,encoding:'utf8',timeout:30000});
 await writeFile(join(output,'integration-tests.tap'),qa.stdout+'\n'+qa.stderr);assert.equal(qa.status,0);
 const integrationTests=Number(qa.stdout.match(/^# pass (\d+)$/m)?.[1]);assert.ok(integrationTests>0);
 const search=async platform=>{
  const response=await worker.fetch(new Request('https://boltech-group.pages.dev/api/leo-integrations',{method:'POST',headers:{Authorization:'Bearer '+env.LEO_PLATFORM_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({action:'search',platform,query:'import distributors'})}),env);
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.success,true);return data;
 };
 const explee=await search('explee'),freelancer=await search('freelancer');
 assert.equal(explee.items.length,6);assert.equal(freelancer.items.length,1);
 add('Descubrimiento en ambas plataformas','ACTUAL_WORKER_WITH_SYNTHETIC_PROVIDER_RESPONSES',{expleeCompanies:6,freelancerProjects:1,countries,productionSearch:false});
 const opportunity={id:'SYN_PDRO_OPPORTUNITY_001',company:'Pdro Imports',country:'SV',sourceRefs:['SYN_EXPLEE_PDRO','SYN_FREELANCER_PDRO'],realCustomer:false};
 add('Unificar oportunidad de Pedro','SCRIPTED_COMMERCIAL_FIXTURE',{opportunity,uniqueBuyer:1,productionDeduplicationVerified:false});
 let intake={step:0,answers:[]};
 for(const answer of ['Atender consultas repetidas de productos por WhatsApp fuera de horario','WhatsApp Business y Excel','100 consultas al mes, dato ficticio','Responder FAQ y derivar cotizaciones a Pedro; plazo por acordar','pedro@pdro.example.test'])intake=salesReply(answer,intake,'es');
 assert.equal(intake.complete,true);assert.equal(intake.summary.quoteStatus,'PENDING_APPROVAL');
 add('Diagnóstico y calificación','ACTUAL_GUIDED_INTAKE_FUNCTION',{summary:intake.summary,approver:'Pedro (ficticio)',scopeConfirmedByFixture:true,generativeModelTested:false,productionEndpointTested:false});
 const proposal={id:'SYN_PDRO_QUOTE_001',status:'DRAFT_REQUIRES_OWNER_REVIEW',scope:['Una empresa','Atención de FAQ y catálogo por WhatsApp','Derivar cotizaciones y excepciones a Pedro'],exclusions:['Cobros automáticos','Reembolsos','Inventario sincronizado','Campañas'],amountUsd:null,pricing:'PENDING_REAL_APPROVED_QUOTE',sentExternally:false};
 const followup={id:'SYN_PDRO_FOLLOWUP_001',text:'Pedro, ¿el alcance cubre las consultas que deseas resolver? Confirmemos catálogo, FAQ, derivaciones y criterios de aceptación.',status:'CAPTURED_LOCALLY_NOT_SENT'};
 add('Propuesta y seguimiento','SCRIPTED_COMMERCIAL_FIXTURE',{proposal,followup,noPriceInvented:true});
 const advance=(record,authorization)=>{if(authorization!==true)throw Error('OWNER_APPROVAL_REQUIRED');return {...record,status:'APPROVED_IN_SYNTHETIC_SCENARIO'};};
 assert.throws(()=>advance(proposal,false),/OWNER_APPROVAL_REQUIRED/);
 const approval=advance(proposal,true);
 add('Aprobación y cierre del acuerdo','SCRIPTED_HUMAN_APPROVAL_FIXTURE',{approval,realContract:false,unauthorizedTransitionBlockedInDriver:true,productionApprovalGateTested:false});
 add('Pago ficticio','USER_AUTHORIZED_SCENARIO_ASSUMPTION',{status:'PAID_IN_FULL_SIMULATED',amountUsd:null,providerTransactionId:null,realRevenueUsd:0,wompiCalled:false});
 const setup=validateCustomerOnboarding({company:'Pdro Imports (empresa ficticia)',contact:'Pedro (ficticio)',email:'pedro@pdro.example.test',description:'Distribuidora ficticia para probar consultas de productos.',hours:PDRO_TEST_BUSINESS.hours,address:'',shipping:PDRO_TEST_BUSINESS.shipping,returns:PDRO_TEST_BUSINESS.returns,handoff:'Pedro revisa cotizaciones, reclamos y reembolsos; datos ficticios.',catalog:PDRO_TEST_BUSINESS.catalog.map(p=>({sku:p.sku,name:p.name,description:'Producto ficticio de prueba',priceUsd:p.priceUsd,availability:'Existencias ficticias: '+p.stock})),faqs:[{question:'¿Quién aprueba una cotización?',answer:'Pedro, en este escenario ficticio.'}],confirmed:true});
 assert.equal(setup.valid,true);assert.equal(setup.configuration.agentActivated,false);assert.equal(setup.configuration.paymentVerified,false);
 add('Catálogo, FAQ y políticas','ACTUAL_ONBOARDING_VALIDATOR',{valid:true,configuration:setup.configuration,productionSaved:false});
 const support=await runAcceptance();
 assert.equal(support.mode,'SYNTHETIC_ONLY');assert.equal(support.realPaymentReceived,false);assert.equal(support.realWhatsAppConnected,false);
 add('Atención, casos y recuperación','ACTUAL_SUPPORT_SANDBOX_AND_LOOPBACK_HTTP',{...support.evidence,businessScenario:support.businessScenario,liveAiInferenceVerified:false,realWhatsAppConnected:false});
 assert.equal(support.order.delivery,'SANDBOX_DELIVERED_FOR_REVIEW');assert.equal(support.order.customerAcceptance,'PENDING');
 add('Entrega para revisión','ACTUAL_SUPPORT_SANDBOX',{delivery:support.order.delivery,actualCustomerAcceptance:'PENDING',productionDelivered:false});
 add('Aceptación final del comprador ficticio','SCRIPTED_BUYER_ACCEPTANCE_FIXTURE',{status:'ACCEPTED_IN_REHEARSAL_ONLY',customer:'Pedro ficticio',actualOrderAcceptanceUnchanged:'PENDING',realCustomerAcceptance:false});
 const journal=join(output,'journal.json');await writeFile(journal,JSON.stringify({mode:'SYNTHETIC_ONLY',steps},null,2));
 const restored=JSON.parse(await readFile(journal,'utf8'));assert.equal(restored.steps.length,steps.length);
 assert.equal(externalNetworkAttempts,0);assert.ok(receipts.filter(r=>r.value.status==='COMPLETED').length===2);
 const report={schemaVersion:1,at:new Date().toISOString(),mode:'SYNTHETIC_ONLY',customer:'Pedro / Pdro Imports',orderId:'SYN_PDRO_IMPORTS_001',countries,steps,integrationTests,supportTests:support.evidence.testsPassed,geographicFilterTested:'STRUCTURED_REQUEST_AND_FIXTURES_ONLY',productionCountryResultsVerified:false,localJournalReadback:true,syntheticProviderCalls:requests,localIntegrationReceipts:receipts.map(r=>({...r,value:{...r.value,id:'LOCAL_SYNTHETIC_RECEIPT'}})),externalNetworkAttempts,realMessagesSent:0,realRevenueUsd:0,wompiCalls:0,liveAiInferenceVerified:false,productionReady:false,gaps:['Calificación, propuesta, seguimiento y aceptación comercial se representan mediante fixtures; no prueban un ejecutor comercial productivo.','La atención usa reglas deterministas; no se certifica el chat generativo de Leo.','No se probó búsqueda geográfica real, mensajes en plataformas, pago real, WhatsApp real ni entrega productiva.','La aceptación real de Pedro permanece pendiente; la aceptación final de este recorrido es ficticia.']};
 report.sourceDigest=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
 await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 const rows=steps.map(s=>'| '+s.stage+' | '+s.mechanism+' | Aprobado en prueba |').join('\n');
 const text='# Pedro / Pdro Imports — recorrido comercial sintético\n\nEjecutado: '+report.at+'\n\n**Resultado:** recorrido completo de ensayo. No acredita venta, cobro ni autonomía productiva.\n\nPaíses de Explee: El Salvador, Guatemala, Panamá, Colombia, México y Estados Unidos. El filtro por país está probado con respuestas sintéticas; no verificado contra resultados reales.\n\n| Etapa | Mecanismo ejecutado | Resultado |\n|---|---|---|\n'+rows+'\n\n## Evidencia\n\n- '+integrationTests+' pruebas de integración y '+report.supportTests+' pruebas de atención aprobadas.\n- 8 mensajes HTTP locales más 5 consultas de catálogo y seguimiento; 8 respuestas iniciales capturadas.\n- Firmas, duplicados, aislamiento, cierre de caso y recuperación después de reiniciar comprobados.\n- 0 mensajes reales, 0 llamadas a Wompi, 0 ingresos y 0 solicitudes externas.\n\n## Límites y pendientes\n\n'+report.gaps.map(x=>'- '+x).join('\n')+'\n\n## Propuesta ficticia\n\n'+proposal.scope.map(x=>'- '+x).join('\n')+'\n\nImporte: pendiente de cotización aprobada. El pago completo es una premisa del escenario, no una transacción.\n\nSeguimiento capturado: '+followup.text+'\n';
 await writeFile(join(output,'Recorrido_Comercial_Pdro_Imports.md'),text);
 console.log(JSON.stringify({output,steps:steps.length,integrationTests,supportTests:report.supportTests,externalNetworkAttempts,productionReady:false}));
}finally{globalThis.fetch=originalFetch;}
