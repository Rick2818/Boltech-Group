import {runSynthetic} from '../runner.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 const e=process.env;
 if(e.ASMAS_ENV!=='staging'||e.ASMAS_OUTBOUND_ENABLED!=='false'||e.ASMAS_PAYMENTS_ENABLED!=='false')return res.status(403).json({error:'ISOLATED_STAGING_REQUIRED'});
 const {runId,report}=runSynthetic();
 return res.status(200).json({execution_mode:'OFFLINE_SIMULATION_IN_CLOUD',run_id:runId,certified:false,live_model_calls:0,persistent:false,...report});
}
