import {generateAIResponse} from './ai_sdk.js';

// LLM adapter for review-only B2B content. Evidence URLs come exclusively from the caller.
// The model is not permitted to fabricate sources or assert that links were checked.
export function createMarketingB2BGenerator({generate=generateAIResponse,provider='gemini',modelName='gemini-2.5-flash'}={}){
 return async ({topic,sources})=>{
  if(!Array.isArray(sources)||!sources.length)throw Error('MARKETING_SOURCES_REQUIRED');
  const prompt=JSON.stringify({topic,sourceEvidence:sources.map(s=>({title:s.title,url:s.url,observedAt:s.observedAt})),
   output:'Return only a JSON object with subject,body,industry,buyerRole,businessProblem,proposedSolution,kpis (array),language.',
   constraints:['450+ characters of useful original B2B analysis','Do not fabricate customer examples, ROI, metrics or certifications','Do not claim sources were independently verified','Do not include additional sources','No email, LinkedIn, Upwork outreach']});
  const response=await generate({provider,modelName,prompt,
   system:'You are a B2B marketing analyst. Return strict JSON without markdown. Unverified evidence must be framed as hypotheses.',
   temperature:0.4,maxTokens:1600});
  const raw=String(response?.text||'').trim().replace(/^\x60\x60\x60(?:json)?\s*/i,'').replace(/\s*\x60\x60\x60$/,'');
  let item;try{item=JSON.parse(raw)}catch{throw Error('MARKETING_MODEL_INVALID_JSON')}
  if(!item||typeof item!=='object'||Array.isArray(item)||!Array.isArray(item.kpis))throw Error('MARKETING_MODEL_INVALID_SCHEMA');
  for(const field of ['subject','body','industry','buyerRole','businessProblem','proposedSolution','language']){
   if(typeof item[field]!=='string'||!item[field].trim())throw Error('MARKETING_MODEL_INVALID_SCHEMA');
  }
  if(!['es','en'].includes(item.language))throw Error('MARKETING_MODEL_INVALID_LANGUAGE');
  return item;
 };
}
