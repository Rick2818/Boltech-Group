// Read-only guided sales conversation; no dispatch, checkout or misleading sale receipts.
export function salesReply(message, state={step:0,answers:[]},language='es'){
 const lang=language==='en'?'en':'es';const txt=String(message||'').trim().slice(0,800);
 const messages={
 es:['¡Hola! Soy Leo, el asistente de Ventas de Boltech. ¿Qué proceso de tu empresa quieres mejorar?','¿Qué herramientas utiliza tu equipo actualmente?','¿Cuántas solicitudes o tareas manejan aproximadamente al mes?','¿Qué resultado te gustaría conseguir y cuándo?','¿En qué correo podemos contactarte para preparar una propuesta?'],
 en:['Hello! I am Leo, Boltech’s Sales assistant. What business process would you like to improve?','Which tools does your team currently use?','Approximately how many requests or tasks do you handle each month?','What outcome do you want, and by when?','What email should we use to follow up with a proposal?']};
 const step=Math.max(0,Math.min(5,Number(state.step)||0));
 const answers=Array.isArray(state.answers)?state.answers.slice(0,5):[];
 if(!txt)return {step,answers,reply:messages[lang][step]||messages[lang][4],complete:false};
 answers[step]=txt;const next=step+1;
 if(next<5)return {step:next,answers,reply:messages[lang][next],complete:false};
 const email=answers[4]||'',valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 if(!valid)return {step:4,answers,reply:lang==='es'?'Necesito un correo válido para continuar.':'Please provide a valid email to continue.',complete:false};
 return {step:5,answers,complete:true,reply:lang==='es'?'Gracias. Preparé un resumen de tus necesidades. El siguiente paso es solicitar una cotización; no se ha enviado ninguna comunicación ni realizado ningún cobro.':'Thank you. Your requirements summary is ready. You may request a quote; no communication or payment has taken place.',
 summary:{problem:answers[0],tools:answers[1],volume:answers[2],goal:answers[3],email,quoteStatus:'PENDING_APPROVAL',commercialOwner:'AGENT_1',factoryStatus:'NOT_ORDERED'}};
}
