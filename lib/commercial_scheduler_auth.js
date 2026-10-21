import {timingSafeEqual} from 'node:crypto';

// The dedicated scheduler key grants access only to the three operational routes
// that explicitly import this helper. It is not an administrator credential.
export function commercialSchedulerAuthorized(req,env=process.env){
 const value=req.headers?.authorization;
 if(typeof value!=='string')return false;
 return [env.CRON_SECRET,env.BOLTECH_SCHEDULER_SECRET].filter(Boolean).some(secret=>{
  const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(value);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
 });
}
