import {assessB2BContent,selectB2BTopic} from './marketing_b2b_strategy.js';

// Independent B2B marketing draft preparation; no email, LinkedIn, or Sales side effects.
// Caller must supply sourced market intelligence and a text generator.
export async function prepareMarketingB2BDraft({history=[],demand={},performance={},research,generator,now=new Date()}={}){
 if(typeof generator!=='function')throw Error('MARKETING_GENERATOR_REQUIRED');
 if(!Array.isArray(research)||!research.length)throw Error('SOURCED_RESEARCH_REQUIRED');
 const sources=research.filter(x=>/^https:\/\//.test(x.url||'')&&x.title&&x.observedAt);
 if(!sources.length)throw Error('VERIFIABLE_SOURCES_REQUIRED');
 const topic=selectB2BTopic({history,demand,performance});
 const draft=await generator({topic,sources,requirements:{
  buyerRole:true,industry:true,businessProblem:true,proposedSolution:true,kpis:true,
  language:['en','es'],minimumCharacters:450,avoidUnverifiedClaims:true
 }});
 const item={...draft,topic,sources};
 const quality=assessB2BContent(item,{previous:history});
 return {status:quality.approved?'READY_FOR_REVIEW':'REJECTED_QUALITY',item,quality,createdAt:now.toISOString(),publicationStatus:'NOT_PUBLISHED'};
}
