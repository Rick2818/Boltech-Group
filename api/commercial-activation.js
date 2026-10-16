import {requireOperationalAuth} from '../lib/operational_auth.js';
import {createInteragentCoordinator} from '../lib/interagent_coordinator.js';

// Operational control point for existing agents. It never invokes bulk mail dispatch.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!requireOperationalAuth(req,res))return;
  if(!['GET','POST'].includes(req.method))return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});
  const worker=createInteragentCoordinator();
  try{
    const [sales,marketing]=await Promise.all([worker.queue('RSI-01'),worker.queue('MARKETING')]);
    if(req.method==='GET')return res.status(200).json({success:true,roles:{'RSI-01':{pending:sales.pending.length},MARKETING:{pending:marketing.pending.length}},autonomousSendingEnabled:false});
    // Respect existing requests and no automatic outreach; marketing processing only.
    const pending=await worker.marketing.managePending();
    const metrics=await worker.marketing.metrics();
    return res.status(200).json({success:true,existingMarketingProcessed:true,pendingManagement:pending,metrics,autonomousSendingEnabled:false,commercialSaleInferred:false});
  }catch(e){
    const allowed=/^(?:MARKETING_|INTERAGENT_|GMAIL_)[A-Z_]+$/;
    return res.status(503).json({success:false,code:allowed.test(e?.code||'')?e.code:'COMMERCIAL_ACTIVATION_UNCONFIRMED'});
  }
}
