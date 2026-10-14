// A4 Director: deterministic, auditable orchestration policy for synthetic ASMAS runs.
// This policy prepares instructions; it does not execute, email, charge or mutate the queue.
export const DIRECTOR_STEPS=Object.freeze([
 Object.freeze({agent:'A1',objective:'Qualify and deduplicate the synthetic prospect; record evidence and uncertainties'}),
 Object.freeze({agent:'A2',objective:'Draft a quotation using approved catalog/pricing only; do not send'}),
 Object.freeze({agent:'A3',objective:'Evaluate commercial readiness; verify payment evidence but never charge or claim a sale'})
]);
export function directorPlan({runId,marketAnalysis,mode='SYNTHETIC_ANALYSIS'}={}){
 if(mode!=='SYNTHETIC_ANALYSIS')throw Error('DIRECTOR_SYNTHETIC_ONLY');
 if(typeof runId!=='string'||!/^[0-9a-f-]{36}$/i.test(runId))throw Error('RUN_ID_REQUIRED');
 if(typeof marketAnalysis!=='string'||!marketAnalysis.trim())throw Error('A5_ANALYSIS_REQUIRED');
 return Object.freeze({schema_version:'asmas.director.v1',director:'A4',run_id:runId,mode,
  approved:false,commercial_flow_certified:false,external_actions_allowed:false,
  assignments:DIRECTOR_STEPS.map((step,index)=>Object.freeze({
   ...step,step:index+1,depends_on:index===0?'A5':DIRECTOR_STEPS[index-1].agent,
   status:'PLANNED',approval_required:true,synthetic:true
  }))
 });
}
export function validateDirectorHandoff(plan,{destination,completedAgents=[]}={}){
 if(plan?.schema_version!=='asmas.director.v1'||plan.director!=='A4'||plan.mode!=='SYNTHETIC_ANALYSIS'||plan.external_actions_allowed!==false)throw Error('DIRECTOR_POLICY_INVALID');
 const next=plan.assignments?.find(a=>a.agent===destination);
 if(!next||next.status!=='PLANNED'||next.synthetic!==true)throw Error('DIRECTOR_ROUTE_INVALID');
 if(!completedAgents.includes(next.depends_on))throw Error('DIRECTOR_DEPENDENCY_MISSING');
 return Object.freeze({director:'A4',destination_agent:destination,objective:next.objective,run_id:plan.run_id,synthetic:true,external_actions_allowed:false});
}

export function directorNextTask({plan,completedAgents=[],outputs={}}={}){
 if(!plan||!Array.isArray(plan.assignments))throw Error('DIRECTOR_PLAN_REQUIRED');
 const completed=new Set(completedAgents);
 for(const assignment of plan.assignments){
  if(completed.has(assignment.agent))continue;
  const order=validateDirectorHandoff(plan,{destination:assignment.agent,completedAgents});
  if(assignment.depends_on!=='A5'&&typeof outputs[assignment.depends_on]!=='string')throw Error('PREVIOUS_OUTPUT_REQUIRED');
  return Object.freeze({case_id:'SYN-E2E-001',agent:assignment.agent,action:'SYNTHETIC_ANALYSIS',
   idempotency_key:plan.run_id+':'+assignment.agent,
   payload:Object.freeze({run_id:plan.run_id,is_synthetic:true,orchestration:Object.freeze({
    ...order,depends_on:assignment.depends_on,approval_required:true,
    instructions:assignment.objective,previous_output:outputs[assignment.depends_on]||null
   })})});
 }
 return null;
}
