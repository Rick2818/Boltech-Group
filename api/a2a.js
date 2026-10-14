// Legacy commercial endpoint retired. No lead processing or outbound effects.
// Preserved intentionally as HTTP 410 to block both direct function requests and gateway forwarding.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Deprecation','true');
 return res.status(410).json({error:'LEGACY_COMMERCIAL_RETIRED',message:'Legacy commercial process retired; no automatic redirection to a new provider.'});
}
