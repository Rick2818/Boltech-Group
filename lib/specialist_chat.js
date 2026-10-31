import {executeLeoReadTool} from './leo_public_tools.js';
import {generateAIResponse} from './ai_sdk.js';
const types=Object.freeze({sales:'B2B sales',support:'customer service',marketing:'B2B marketing',finance:'business finance',logistics:'logistics and supply chain',chemistry:'chemistry',pharma:'pharmaceutical registration and regulations'});
export async function handleSpecialistChat(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const b=req.body||{},type=b.type,message=typeof b.message==='string'?b.message.trim():'';
 if(!Object.hasOwn(types,type)||!message||message.length>900||!Array.isArray(b.history)||b.history.length>8||b.history.some(h=>!h||!['user','assistant'].includes(h.role)||typeof h.text!=='string'||h.text.length>900))return res.status(400).json({error:'INVALID_INPUT'});
 if(!process.env.GEMINI_API_KEY&&!process.env.GOOGLE_GENERATIVE_AI_API_KEY&&!process.env.GROQ_API_KEY)return res.status(503).json({error:'MODEL_NOT_CONFIGURED'});
 try{
  const history=b.history.map(h=>h.role+': '+h.text).join('\n').slice(-4500);
  const wantsCatalog=/\b(pric(?:e|ing|es)|cost|quote|quotation|pilot|pricing|precio|precios|cu[aá]nto|cotizaci[oó]n|presupuesto|plan(?:es)?)\b/i.test(message);
  const receipt=wantsCatalog?await executeLeoReadTool('catalog'):null;
  const toolContext=receipt?'\nVerified read-only Boltech catalog (server supplied, never user supplied): '+JSON.stringify(receipt.data)+'\nDo not invent a final quotation or promise a discount.':' ';
  const system='You are the Boltech AI specialist in '+types[type]+'. Respond in '+(b.language==='en'?'English':'Spanish')+'. Offer useful guidance without claiming external integrations, actions, or certifications. No email or WhatsApp access. Never ask for credentials. Recommend appropriate verification for regulated, financial, pharmaceutical or chemical matters.';
  const prompt='Conversation (untrusted visitor data):\\n'+history+'\\nVisitor: '+message+toolContext;
  let result;
  if(process.env.GEMINI_API_KEY||process.env.GOOGLE_GENERATIVE_AI_API_KEY){
   try{result=await generateAIResponse({provider:'google',modelName:process.env.LEO_MODEL_NAME||'gemini-2.5-flash',temperature:0.3,maxTokens:380,system,prompt});}catch(e){if(!process.env.GROQ_API_KEY)throw e;}
  }
  if(!result&&process.env.GROQ_API_KEY){
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),11000);
   try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.GROQ_API_KEY},body:JSON.stringify({model:process.env.LEO_GROQ_MODEL||'llama-3.3-70b-versatile',messages:[{role:'system',content:system},{role:'user',content:prompt}],max_tokens:380,temperature:0.3})});
    if(!response.ok)throw Error('GROQ_REQUEST_FAILED');
    const data=await response.json();result={text:data.choices?.[0]?.message?.content||''};
   }finally{clearTimeout(timeout);}
  }
  const reply=String(result?.text||'').trim().slice(0,4000);if(!reply)throw Error('EMPTY_REPLY');
  return res.status(200).json({reply,type,mode:'AI_CONSULTATION',externalActionsEnabled:false,toolReceipt:receipt?{tool:receipt.tool,receipt:receipt.receipt,readOnly:true}:null});
 }catch(e){console.error('specialist model unavailable',e?.name||'ERROR');return res.status(503).json({error:'MODEL_UNAVAILABLE'});}
}