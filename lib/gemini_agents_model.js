// Official OpenAI Agents SDK extension for Vercel AI SDK providers.
// No OpenAI API key, endpoint or model is used by this factory.
export async function createGeminiAgentsModel({
  model='gemini-2.5-flash',
  apiKey,
  imports=async()=>Promise.all([import('@ai-sdk/google'),import('@openai/agents-extensions/ai-sdk')]),
}={}){
  if(model!=='gemini-2.5-flash')throw new Error('GEMINI_MODEL_NOT_ALLOWED');
  if(typeof apiKey!=='string'||!apiKey.trim())throw new Error('GEMINI_KEY_MISSING');
  const [{createGoogleGenerativeAI},{aisdk}]=await imports();
  if(typeof createGoogleGenerativeAI!=='function'||typeof aisdk!=='function')
    throw new Error('GEMINI_AGENTS_ADAPTER_UNAVAILABLE');
  const google=createGoogleGenerativeAI({apiKey});
  return aisdk(google(model));
}
