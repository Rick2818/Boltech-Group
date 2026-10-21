import {readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,dirname,relative,extname} from 'node:path';
const roots=['api','lib','scripts','.github/workflows','tests'];
const legacy=/^(?:lib\/(?:sdr_(?:dispatch|campaign)|rsi01_[\w]+|rsi02_inbox_executor|rsi03_closing|rsi_agent_executor|airtable_partner_store|marketing_crm_executor)\.js|scripts\/(?:rsi01-[\w-]+\.cjs|ops\/run_rsi_agents\.mjs))$/;
function files(dir){try{return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(dir+'/'+d.name):d.isFile()?[dir+'/'+d.name]:[]);}catch{return [];}}
function audit(){
 const edges=[],airtable=[],rsiRefs=[],workflows=[],prod=[];
 for(const path of roots.flatMap(files).filter(p=>/\.(?:js|mjs|cjs|yml|yaml)$/.test(p))){
  const s=readFileSync(path,'utf8');
  const isProduction=!path.startsWith('tests/');
  const imports=/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  for(const m of s.matchAll(imports)){
   if(!m[1].startsWith('.'))continue;
   const destination=relative('.',resolve(dirname(path),m[1])).replaceAll('\\','/');
   const filename=extname(destination)?destination:destination+'.js';
   if(legacy.test(filename))edges.push({source:path,target:filename,production:isProduction,line:s.slice(0,m.index).split('\n').length});
  }
  if(isProduction&&/\bAIRTABLE_TOKEN\b|api\.airtable\.com|AIRTABLE_PAT\b/.test(s))
   airtable.push(path);
  if(path.startsWith('api/')&&/rsi01-|sdr-(?:send|campaign|reconcile)|marketing-crm-intake|commercial-activation/.test(s))
   rsiRefs.push(path);
  if(path.startsWith('.github/workflows/')&&/^\s*schedule:/m.test(s))
   workflows.push(path);
  if(isProduction&&/^lib\/(?:agent1_continuous_cycle|agent1_company_draft_review|agent1_autonomous_inbox|marketing_sales_cycle_v2|explee_hot_leads_sync)\.js$/.test(path)){
   prod.push(path);
   if(edges.some(e=>e.source===path))throw Error('LEGACY_IMPORT_IN_CANONICAL_RUNTIME:'+path);
  }
 }
 return {canonical:prod.sort(),productionLegacyEdges:edges.filter(x=>x.production).sort((a,b)=>a.source.localeCompare(b.source)),testLegacyEdges:edges.filter(x=>!x.production).sort((a,b)=>a.source.localeCompare(b.source)),airtableReferences:airtable.sort(),apiLegacyRoutes:rsiRefs.sort(),scheduledWorkflowFiles:workflows.sort()};
}
const report=audit();
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else process.stdout.write(JSON.stringify({productionLegacyEdges:report.productionLegacyEdges.length,testLegacyEdges:report.testLegacyEdges.length,airtableReferences:report.airtableReferences.length,apiLegacyRoutes:report.apiLegacyRoutes.length,scheduledWorkflows:report.scheduledWorkflowFiles.length})+'\n');
export {audit};
