import {BaseAgent, InMemoryRunner, createEvent} from '@google/adk';
import {createRsiExecutor} from './rsi_agent_executor.js';

export const COMMERCIAL_AGENT_IDS = Object.freeze(['RSI-01', 'RSI-02', 'RSI-03', 'MARKETING']);
const descriptions = {
  'RSI-01': 'Investiga y prepara contacto escrito con evidencia y revisión de historial.',
  'RSI-02': 'Califica, diagnostica y prepara propuestas según alcance autorizado.',
  'RSI-03': 'Gestiona cierre y evidencia de pago; informa a Dirección antes de Ricardo.',
  MARKETING: 'Prepara materiales para necesidades concretas de los tres agentes de venta.',
};

// Custom ADK agents execute existing code. There is no LlmAgent, model fallback,
// API key loading or generation call in this runtime. Durable receipts and leases
// remain in the existing executor; ephemeral ADK sessions are not business memory.
class CommercialAgent extends BaseAgent {
  constructor(identity, execute) {
    super({name: identity.replaceAll('-', '_'), description: descriptions[identity]});
    this.identity = identity;
    this.execute = execute;
  }
  async *runAsyncImpl(context) {
    const text = context.userContent?.parts?.map(p => p.text || '').join('') || '';
    let input;
    try { input = JSON.parse(text); } catch { throw Object.assign(new Error('ADK_INVALID_INPUT'), {code:'ADK_INVALID_INPUT'}); }
    if (input.rsi !== this.identity || typeof input.cycleId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(input.cycleId)) {
      throw Object.assign(new Error('ADK_INVALID_INPUT'), {code:'ADK_INVALID_INPUT'});
    }
    const result = await this.execute({rsi:this.identity, cycleId:input.cycleId});
    yield createEvent({author:this.name, invocationId:context.invocationId,
      content:{role:'model', parts:[{text:JSON.stringify(result)}]}});
  }
}

export function createGoogleAdkTeam({execute, modelMode='DISABLED'} = {}) {
  // Fail closed even if unrelated Gemini keys are present in the environment.
  if (modelMode !== 'DISABLED') throw Object.assign(new Error('ADK_MODEL_BUDGET_NOT_AUTHORIZED'), {code:'ADK_MODEL_BUDGET_NOT_AUTHORIZED'});
  const worker = execute || createRsiExecutor().run;
  const agents = new Map(COMMERCIAL_AGENT_IDS.map(identity => [identity, new CommercialAgent(identity, worker)]));
  async function run(input) {
    const agent = agents.get(input?.rsi);
    if (!agent) throw Object.assign(new Error('ADK_INVALID_AGENT'), {code:'ADK_INVALID_AGENT', statusCode:400});
    const runner = new InMemoryRunner({agent, appName:'boltech_commercial'});
    let result;
    for await (const event of runner.runEphemeral({userId:'boltech_executor', newMessage:{role:'user', parts:[{text:JSON.stringify(input)}]}})) {
      if (event.author === agent.name && event.content?.parts?.[0]?.text) result = JSON.parse(event.content.parts[0].text);
    }
    if (!result?.receipt) throw Object.assign(new Error('ADK_EXECUTION_UNCONFIRMED'), {code:'ADK_EXECUTION_UNCONFIRMED'});
    return {...result, orchestration:{sdk:'@google/adk', mode:'CUSTOM_CODE', modelCalls:0, agentId:input.rsi}};
  }
  return {agents, run, modelMode};
}
