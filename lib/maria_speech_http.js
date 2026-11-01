const calls=new Map();
export async function handleMariaSpeech(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const {AZURE_SPEECH_KEY,AZURE_SPEECH_REGION,AZURE_SPEECH_F0_CONFIRMED}=process.env;
 if(AZURE_SPEECH_F0_CONFIRMED!=='true'||!AZURE_SPEECH_KEY||!AZURE_SPEECH_REGION)return res.status(503).json({error:'MARIA_NOT_CONFIGURED'});
 const region=String(AZURE_SPEECH_REGION).toLowerCase();
 if(!/^[a-z0-9]{3,24}$/.test(region))return res.status(503).json({error:'REGION_INVALID'});
 const text=typeof req.body?.text==='string'?req.body.text.trim():'';
 if(!text||text.length>400)return res.status(400).json({error:'TEXT_LENGTH'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].slice(0,80);
 const now=Date.now(),entry=calls.get(ip)||{count:0,until:now+60000};
 if(now>entry.until){entry.count=0;entry.until=now+60000;}entry.count++;calls.set(ip,entry);
 if(entry.count>6)return res.status(429).json({error:'RATE_LIMIT'});
 const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const ssml='<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="es-CR"><voice name="es-CR-MariaNeural">'+escape(text)+'</voice></speak>';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const r=await fetch('https://'+region+'.tts.speech.microsoft.com/cognitiveservices/v1',{method:'POST',signal:ctrl.signal,headers:{'Ocp-Apim-Subscription-Key':AZURE_SPEECH_KEY,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-16khz-16bit-mono-pcm','User-Agent':'Boltech-Maria-TTS'},body:ssml});
  if(!r.ok)return res.status(502).json({error:'AZURE_SPEECH_UNAVAILABLE'});
  const audio=Buffer.from(await r.arrayBuffer());
  if(audio.length>2_000_000)return res.status(502).json({error:'AUDIO_TOO_LARGE'});
  res.setHeader('Content-Type','audio/wav');return res.status(200).send(audio);
 }catch{return res.status(503).json({error:'SPEECH_TIMEOUT'});}finally{clearTimeout(timer);}
}