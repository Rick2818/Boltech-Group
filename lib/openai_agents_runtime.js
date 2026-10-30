import {createGeminiAgentsModel} from './gemini_agents_model.js';
// Provider-neutral Agents SDK runtime: requires an injected Gemini model adapter. Never sends mail, charges,
// provisions tenants, or marks an order delivered.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(x);
export function createOpenAIAgentsRuntime({sdkLoader=()=>import('@openai/agents'), env=process.env, persistence, modelFactory=createGeminiAgentsModel}={}){
  if (!persistence || typeof persistence.load!=='function' || typeof persistence.save!=='function')
    fail('AGENTS_PERSISTENCE_NOT_CONFIGURED');
  async function execute({orderId,customerId,tenantId,task,expectedVersion,model='gemini-2.5-flash'}={}){
    if(env.BOLTECH_AGENTS_SDK_ENABLED!=='true')fail('AGENTS_RUNTIME_DISABLED');
    if(!env.GEMINI_API_KEY)fail('AGENTS_GEMINI_KEY_NOT_CONFIGURED');
    if(typeof modelFactory!=='function')fail('AGENTS_GEMINI_ADAPTER_NOT_CONFIGURED');
    if(!valid(orderId)||!valid(customerId)||!valid(tenantId)||
       !Number.isSafeInteger(expectedVersion)||typeof task!=='string'||!task.trim()||task.length>12000)
      fail('AGENTS_INPUT_INVALID');
    const record=await persistence.load({orderId,customerId,tenantId});
    if(!record||record.orderId!==orderId||record.customerId!==customerId||
       record.tenantId!==tenantId||record.version!==expectedVersion||
       record.status!=='AUTHORIZED')fail('AGENTS_TENANT_AUTHORIZATION_REQUIRED');
    if(model!=='gemini-2.5-flash')fail('AGENTS_UNAPPROVED_MODEL');
    const geminiModel=await modelFactory({model,apiKey:env.GEMINI_API_KEY});
    if(!geminiModel || typeof geminiModel!=='object')fail('AGENTS_GEMINI_MODEL_UNAVAILABLE');
    const {Agent,run}=await sdkLoader();
    if(typeof Agent!=='function'||typeof run!=='function')fail('AGENTS_SDK_INVALID');
    const agent=new Agent({name:'Boltech task assistant',model:geminiModel,
      instructions:'Execute only the authorized task. Never claim actions not performed. No payments, messages, provisioning or external side effects. Ask for approval before any sensitive operation.',tools:[]});
    const result=await run(agent,task,{maxTurns:8});
    const output=result?.finalOutput;
    if(typeof output!=='string'||!output.trim())fail('AGENTS_EMPTY_OUTPUT');
    const latest=await persistence.load({orderId,customerId,tenantId});
    if(!latest||latest.version!==expectedVersion||latest.status!=='AUTHORIZED')
      fail('AGENTS_AUTHORIZATION_CHANGED');
    await persistence.save({orderId,customerId,tenantId,expectedVersion,
      receipt:{status:'TASK_COMPLETED_NOT_DELIVERED',output,
        model,at:new Date().toISOString()}});
    return {status:'TASK_COMPLETED_NOT_DELIVERED',customerDelivery:false,orderId,tenantId,output};
  }
  return {execute};
}
