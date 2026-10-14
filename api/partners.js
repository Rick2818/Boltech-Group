// Previous commercial API disabled during ASMAS migration; no legacy execution.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Deprecation','true');
 return res.status(410).json({error:'LEGACY_COMMERCIAL_RETIRED',message:'This legacy commercial endpoint has been retired.'});
}
