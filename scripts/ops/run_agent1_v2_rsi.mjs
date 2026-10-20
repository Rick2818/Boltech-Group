// Cloud RSI observer for Agent 1 V2 only. Read-only GitHub run telemetry.
// This module never calls an LLM, modifies repos, deploys, purchases or sends.
import {agent1RecursiveImprovement} from '../../lib/agent1_v2_recursive_improvement.js';
import {writeFile,mkdir} from 'node:fs/promises';
const repository=process.env.GITHUB_REPOSITORY;
const workflow='agent1_v2_market_skills_qa.yml';
export async function runAgent1Rsi({fetcher=fetch,env=process.env}={}){
 if(!/^[-\w.]+\/[-\w.]+$/.test(String(env.GITHUB_REPOSITORY||'')))throw Error('RSI_REPO_REQUIRED');
 if(!env.GITHUB_TOKEN)throw Error('RSI_READ_TOKEN_REQUIRED');
 const url='https://api.github.com/repos/'+env.GITHUB_REPOSITORY+'/actions/workflows/'+workflow+'/runs?per_page=15&branch=agent1-rebuild-20261020';
 const response=await fetcher(url,{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('RSI_GITHUB_READ_'+response.status);
 const data=await response.json();
 if(!Array.isArray(data.workflow_runs))throw Error('RSI_TELEMETRY_INVALID');
 const completed=data.workflow_runs.filter(r=>r.status==='completed');
 const failures=completed.filter(r=>r.conclusion==='failure').length;
 const observations=failures?[{issueCode:'CI_REGRESSION',count:failures}]:[];
 const rsi=agent1RecursiveImprovement({agent:'AGENT1_V2',observations});
 return {schema:'boltech.agent1.v2.rsi.telemetry.v1',scope:'AGENT1_V2',checked:completed.length,
   failed:failures,source:'GITHUB_ACTIONS_READ_ONLY',rsi,productiveActions:false};
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 try{
  const result=await runAgent1Rsi();
  await mkdir('ops-output',{recursive:true});
  await writeFile('ops-output/agent1-v2-rsi-receipt.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({scope:result.scope,checked:result.checked,failed:result.failed,proposals:result.rsi.proposals.length,receipt:'ops-output/agent1-v2-rsi-receipt.json'}));
 }catch(e){console.error('AGENT1_RSI_BLOCKED',e.message);process.exitCode=1;}
}
