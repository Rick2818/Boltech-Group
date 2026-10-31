import {verifyMarketingResearch} from './marketing_research_gate.js';
import {createMarketingB2BGenerator} from './marketing_b2b_generator.js';
import {runMarketingB2BPreparedCycle} from './marketing_b2b_executor.js';

// Independent B2B preparation. Never publishes or changes the active cron.
export async function runMarketingB2BVerifiedCycle(options={}){
 const {candidates=[],allowedHosts=[],researchFetcher=fetch,dbFetcher=fetch,generate,env=process.env,history=[],demand={},performance={}}=options;
 const sources=await verifyMarketingResearch({candidates,allowedHosts,fetcher:researchFetcher});
 if(sources.length===0)return {status:'NO_VERIFIED_SOURCES',persisted:false,published:false};
 const generator=createMarketingB2BGenerator(generate?{generate}:{});
 const result=await runMarketingB2BPreparedCycle({env,fetcher:dbFetcher,research:sources,generator,history,demand,performance});
 return {...result,verifiedSources:sources.length};
}
