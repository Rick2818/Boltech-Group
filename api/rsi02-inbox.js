import crypto from 'node:crypto';
import {createRsi02InboxExecutor} from '../lib/rsi02_inbox_executor.js';
export const config={maxDuration:60};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const expected=String(process.env.CRON_SECRET||'');
 const actual=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'').trim();
 const a=Buffer.from(expected),b=Buffer.from(actual);
 if(!a.length||a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({success:false,code:'CRON_AUTH_REQUIRED'});
 if(req.method!=='GET')return res.status(405).json({success:false,code:'METHOD_NOT_ALLOWED'});
 try{return res.status(200).json(await createRsi02InboxExecutor().run());}
 catch(e){return res.status(503).json({success:false,code:/^[A-Z0-9_]+$/.test(e?.code||'')?e.code:'RSI02_EXECUTOR_UNAVAILABLE'});}
}
