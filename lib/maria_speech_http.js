import {getRedisClient} from './distributed_cache.js';
const MAX_MONTHLY_CHARS=100000;
const MAX_REQUEST_CHARS=300;
const SCRIPT="local current=redis.call('GET',KEYS[1]); local used=tonumber(current or '0'); local amount=tonumber(ARGV[1]); local cap=tonumber(ARGV[2]); if used+amount>cap then return -1 end; local next=redis.call('INCRBY',KEYS[1],amount); if next==amount then redis.call('EXPIRE',KEYS[1],tonumber(ARGV[3])) end; return next";
export async function handleMariaSpeech(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const {AZURE_SPEECH_KEY,AZURE_SPEECH_REGION,AZURE_SPEECH_F0_CONFIRMED}=process.env;
 if(AZURE_SPEECH_F0_CONFIRMED!=='true'||!AZURE_SPEECH_KEY||!AZURE_SPEECH_REGION)return res.status(503).json({error:'MARIA_NOT_CONFIGURED'});
 const region=String(AZURE_SPEECH_REGION).toLowerCase();
 if(!/^[a-z0-9]{3,24}$/.test(region))return res.status(503).json({error:'REGION_INVALID'});
 const phrase=typeof req.body?.text==='string'?req.body.text.trim():'';
 if(!phrase||phrase.length>MAX_REQUEST_CHARS)return res.status(400).json({error:'TEXT_LENGTH'});
 const origin=req.headers.origin;
 const host=req.headers.host;
 if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'ORIGIN_DENIED'});}catch{return res.status(403).json({error:'ORIGIN_DENIED'});}}
 // No local-memory fallback: distributed capacity must be available before sending requests.
 const redis=getRedisClient();if(!redis)return res.status(503).json({error:'QUOTA_STORE_UNAVAILABLE'});
 const month=new Date().toISOString().slice(0,7),key='boltech:maria:tts:chars:'+month;
 try{const count=await redis.eval(SCRIPT,[key],[phrase.length,MAX_MONTHLY_CHARS,35*86400]);if(Number(count)===-1)return res.status(429).json({error:'MONTHLY_VOICE_LIMIT'});}catch{return res.status(503).json({error:'QUOTA_STORE_UNAVAILABLE'});}
 const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 // Two fixed voices use one shared free-tier quota, preventing monthly allowance resets.
 const isRodrigo=new URL(req.url||'/','https://boltech.local').searchParams.get('rodrigo_speech')==='1';
 const locale=isRodrigo?'es-SV':'es-CR';
 const voice=isRodrigo?'es-SV-RodrigoNeural':'es-CR-MariaNeural';
 const ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="'+locale+'"><voice name="'+voice+'">'+escape(phrase)+'</voice></speak>';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',signal:ctrl.signal,headers:{'Ocp-Apim-Subscription-Key':AZURE_SPEECH_KEY,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-16khz-16bit-mono-pcm','User-Agent':'Boltech-Maria-TTS'},body:ssml});
  if(!r.ok)return res.status(502).json({error:'AZURE_SPEECH_UNAVAILABLE'});
  const audio=Buffer.from(await r.arrayBuffer());
  if(audio.length>2_000_000)return res.status(502).json({error:'AUDIO_TOO_LARGE'});
  res.setHeader('Content-Type','audio/wav');return res.status(200).send(audio);
 }catch{return res.status(503).json({error:'SPEECH_TIMEOUT'});}finally{clearTimeout(timer);}
}
