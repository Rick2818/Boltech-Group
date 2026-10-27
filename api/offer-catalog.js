import { publicOffers } from '../lib/commercial_offer_catalog.js';
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const url=new URL(req.url,'https://boltech.invalid');
 return res.status(200).json(publicOffers(url.searchParams.get('lang')));
}
