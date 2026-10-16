import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {updateHarness} from '../../lib/harness_autodoc.js';
const token=process.env.GITHUB_TOKEN;
if(!token)throw Error('HARNESS_TOKEN_NOT_CONFIGURED');
const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
async function api(method,path,body){
  if(!path.startsWith('/repos/Rick2818/Boltech-Group/')||path.includes('..'))throw Error('HARNESS_API_PATH_DENIED');
  // Never retry a mutation with an uncertain outcome. The next workflow run
  // reconciles its state and stable run/attempt marker before writing again.
  const response=await fetch('https://api.github.com'+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`HARNESS_GITHUB_HTTP_${response.status}`);
  return response.json();
}
let deploymentProbe;try{deploymentProbe=JSON.parse(await readFile('ops-output/harness-vercel-probe.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const result=await updateHarness({api,repository:process.env.GITHUB_REPOSITORY,eventName:process.env.GITHUB_EVENT_NAME,event,deploymentProbe});
await mkdir('ops-output',{recursive:true});
await writeFile('ops-output/harness-live-status.json',JSON.stringify(result,null,2));
await writeFile('ops-output/HARNESS_LIVE_STATUS.md',result.markdown||result.status);
console.log(JSON.stringify({status:result.status,issue:result.issue,tracked:result.tracked,newComments:result.newComments}));
