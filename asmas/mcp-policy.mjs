import {authorize} from './agent-definitions.mjs';
export const INFRA_ROLES=Object.freeze({
 github:['read_repos','read_ci'],supabase:['diagnostics_read'],vercel:['read_deployments','read_logs']
});
export function mayInvoke({agent,platform,operation,environment='staging'}){
 if(platform==='github'||platform==='supabase'||platform==='vercel')
   return agent==='A4'&&INFRA_ROLES[platform].includes(operation);
 if(environment==='production'&&['send_email','create_payment','deploy','update_secret'].includes(operation))return false;
 return authorize(agent,operation);
}
