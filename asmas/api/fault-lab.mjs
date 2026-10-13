import {runFaultLab} from '../fault-lab.mjs';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 if(process.env.ASMAS_ENV!=='staging'||process.env.ASMAS_OUTBOUND_ENABLED!=='false'||process.env.ASMAS_PAYMENTS_ENABLED!=='false')return res.status(403).json({error:'ISOLATED_STAGING_REQUIRED'});
 return res.status(200).json(runFaultLab());
}
