import {orientReception,receptionSteps,receptionPricing,recommendReception} from './reception-guidance.js?v=20261021-sales2';
(() => {
  const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/css/web-reception.css';document.head.append(style);
  const root=document.createElement('aside');root.id='web-reception';root.setAttribute('aria-label','Asistente de Boltech');
  root.innerHTML=`<button type="button" class="reception-launch" aria-expanded="false" aria-controls="reception-panel">¿Qué necesitas automatizar?</button>
  <section id="reception-panel" hidden aria-label="Orientación comercial"><header><div><strong>Asistente de Boltech</strong><small>Encuentra el agente adecuado para tu negocio</small></div><button type="button" class="reception-close" aria-label="Cerrar">×</button></header>
  <p class="reception-intro">Te ayudo a elegir un agente y solicitar una propuesta. Te haré una pregunta a la vez para entender tu proceso y el resultado que buscas. Soy un asistente guiado.</p>
  <div class="reception-log" role="log" aria-live="polite"></div><form class="reception-form"><label class="reception-question" for="reception-answer"></label><input id="reception-answer" maxlength="1000" required autocomplete="off"><button type="button" class="reception-mic" aria-label="Dictar respuesta con el micrófono" aria-pressed="false">🎙 Hablar</button><label class="reception-consent" hidden><input type="checkbox"> Autorizo a Boltech a contactarme por correo sobre esta solicitud.</label><button type="submit">Continuar →</button></form>
  <button type="button" class="reception-scope">¿Qué ofrecen y cuánto cuesta?</button><p class="reception-status" role="status"></p></section>`;
  document.body.append(root);
  const translations={
    es:{launch:'¿Qué necesitas automatizar?',title:'Asistente de Boltech',subtitle:'Encuentra el agente adecuado para tu negocio',intro:'Te ayudo a elegir un agente y solicitar una propuesta. Te haré una pregunta a la vez para entender tu proceso y el resultado que buscas. Soy un asistente guiado.',close:'Cerrar',mic:'🎙 Hablar',consent:'Autorizo a Boltech a contactarme por correo sobre esta solicitud.',scope:'¿Qué ofrecen y cuánto cuesta?',next:'Continuar →',finish:'Solicitar mi propuesta →',welcome:'Cuéntame qué quieres mejorar. No compartas contraseñas ni datos privados de tus clientes.',you:'Tú',pricing:receptionPricing},
    en:{launch:'What do you need to automate?',title:'Boltech Assistant',subtitle:'Find the right agent for your business',intro:"I can help you select an agent and request a proposal. I'll ask one question at a time to understand your workflow and desired results. This is a guided assistant.",close:'Close',mic:'🎙 Speak',consent:'I authorize Boltech to contact me by email about this request.',scope:'What do you offer and how much does it cost?',next:'Continue →',finish:'Request my proposal →',welcome:"Tell me what you would like to improve. Don't share passwords or your customers' private data.",you:'You',pricing:'Pilot: USD 600 (USD 300 upfront and USD 300 after verified delivery), one workflow and one simple integration. General implementation: from USD 900, subject to approved scope. Licenses, usage and maintenance are separate. No automatic purchase or payment.'}
  };
  const enQuestions=['What issue is costing your business time, money or customers?','How does the process work today, step by step?','How much time, money or opportunity do you lose? An estimate is fine.','What tools and data do you use? Do not share passwords or private data.','Who participates and approves decisions? Which actions need human approval?','What measurable result do you need, and by when?','What must the agent never do?','Are you interested in the USD 600 pilot, an agent from USD 900, or more information first?','What is your company name?','Which email address should we use to reply?'];
  const currentLang=()=>document.documentElement.lang?.toLowerCase().startsWith('en')?'en':'es';
  let receptionLang=currentLang();
  function applyReceptionLanguage(){
    receptionLang=currentLang();const t=translations[receptionLang];
    root.setAttribute('aria-label',t.title);root.querySelector('.reception-launch').textContent=t.launch;
    panel.setAttribute('aria-label',t.title);root.querySelector('header strong').textContent=t.title;root.querySelector('header small').textContent=t.subtitle;
    root.querySelector('.reception-intro').textContent=t.intro;root.querySelector('.reception-close').setAttribute('aria-label',t.close);
    root.querySelector('.reception-consent').lastChild.textContent=' '+t.consent;
    root.querySelector('.reception-scope').textContent=t.scope;
    root.querySelector('.reception-voice-language')?.setAttribute('aria-label',receptionLang==='en'?'Dictation language':'Idioma del dictado');
    if(typeof voiceLanguage!=='undefined')voiceLanguage.value=receptionLang==='en'?'en-US':'es-SV';
    if(typeof render==='function')render({preserveDraft:true});
  }
  document.addEventListener('boltech:language-change',applyReceptionLanguage);
  new MutationObserver(()=>{if(receptionLang!==currentLang())applyReceptionLanguage();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const panel=root.querySelector('section'),launch=root.querySelector('.reception-launch'),form=root.querySelector('form'),answer=root.querySelector('#reception-answer'),question=root.querySelector('.reception-question'),log=root.querySelector('.reception-log'),status=root.querySelector('.reception-status'),consent=root.querySelector('.reception-consent'),submit=form.querySelector('button');
  const steps=receptionSteps;
  const mic=root.querySelector('.reception-mic');
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const voiceLanguage=document.createElement('select');voiceLanguage.className='reception-voice-language';voiceLanguage.setAttribute('aria-label','Idioma del dictado');voiceLanguage.innerHTML='<option value="es-SV">Español</option><option value="en-US">English</option>';voiceLanguage.value=/^en\b/i.test(navigator.language||'')?'en-US':'es-SV';mic.before(voiceLanguage);
  let recognition=null,listening=false;
  if(!SpeechRecognition){mic.disabled=true;mic.title='El reconocimiento de voz no está disponible en este navegador';mic.textContent='Micrófono no disponible';}
  else{
    recognition=new SpeechRecognition();
    recognition.lang=/^en\b/i.test(navigator.language||'')?'en-US':'es-SV';
    voiceLanguage.onchange=()=>{if(listening)recognition.stop();recognition.lang=voiceLanguage.value;};
    recognition.interimResults=false;
    recognition.continuous=false;
    recognition.onresult=event=>{
      const transcript=Array.from(event.results).map(result=>result[0]?.transcript||'').join(' ').trim();
      if(transcript){answer.value=[answer.value.trim(),transcript].filter(Boolean).join(' ');answer.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=receptionLang==='en'?'Text captured. Review it and press Continue.':'Texto dictado. Revísalo y presiona Continuar.';}
    };
    recognition.onerror=event=>{status.textContent=event.error==='not-allowed'?(receptionLang==='en'?'Allow microphone access in your browser.':'Permite el acceso al micrófono en tu navegador.'):(receptionLang==='en'?'Speech could not be recognized. You can type your answer.':'No se pudo reconocer la voz. Puedes escribir tu respuesta.');};
    recognition.onend=()=>{listening=false;mic.setAttribute('aria-pressed','false');mic.textContent=translations[receptionLang].mic;};
    mic.onclick=()=>{if(listening){recognition.stop();return;}try{recognition.lang=voiceLanguage.value;recognition.start();listening=true;mic.setAttribute('aria-pressed','true');mic.textContent='■ Detener';status.textContent=receptionLang==='en'?'Listening…':'Escuchando…';}catch{status.textContent=receptionLang==='en'?'Microphone could not start.':'No se pudo iniciar el micrófono.';}};
  }
  const campaignParams=new URLSearchParams(window.location.search);
  const campaignAttribution={utm_source:campaignParams.get('utm_source'),utm_medium:campaignParams.get('utm_medium'),utm_campaign:campaignParams.get('utm_campaign')};
  let step=0,busy=false;const values={};
  function say(text,who='Boltech'){const p=document.createElement('p');p.textContent=`${who}: ${text}`;log.append(p);log.scrollTop=log.scrollHeight;}
  function render({preserveDraft=false}={}){const s=steps[step];question.textContent=receptionLang==='en'?enQuestions[step]:s[1];answer.type=s[2];answer.maxLength=s[3];if(!preserveDraft)answer.value=values[s[0]]||'';consent.hidden=step!==steps.length-1;submit.textContent=step===steps.length-1?translations[receptionLang].finish:translations[receptionLang].next;}
  function close(){if(listening)recognition?.stop();panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus();}
  launch.onclick=()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)answer.focus();};root.querySelector('.reception-close').onclick=close;
  root.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  root.querySelector('.reception-scope').onclick=()=>say(translations[receptionLang].pricing);
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const value=answer.value.trim();if(!value || (step===0 && value.length<4)){status.textContent=receptionLang==='en'?'Please describe the process in more detail.':'Describe un poco más el proceso.';return;}values[steps[step][0]]=value;status.textContent='';
    if(step<steps.length-1){say(value,translations[receptionLang].you);if(step===0)say(orientReception(value,receptionLang));if(steps[step][0]==='limits')say(recommendReception(values,receptionLang).text);step++;render();answer.focus();return;}
    if(!consent.querySelector('input').checked){status.textContent=receptionLang==='en'?'Please authorize contact to register your request.':'Autoriza el contacto para registrar tu solicitud.';return;}
    busy=true;submit.disabled=true;status.textContent=receptionLang==='en'?'Saving your request…':'Guardando tu solicitud…';
    try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,...campaignAttribution,source:'RSI01_WEB',consent:true})});const data=await response.json();
      if(!response.ok || data.success!==true || data.registration?.status!=='RECORDED' || data.assignment?.owner!=='RSI-01')throw Error(data.error||'No se confirmó el registro.');
      form.hidden=true;status.textContent=receptionLang==='en'?`Request registered. Reference: ${data.registration.requestId}. We received your request and purchasing preference for an email proposal. Commercial review is pending; you have not purchased or paid.`:`Solicitud registrada. Referencia: ${data.registration.requestId}. Recibimos tu necesidad y tu preferencia de compra para preparar la propuesta por correo. La revisión comercial está pendiente; aún no has contratado ni pagado.`;
    }catch(error){status.textContent=receptionLang==='en'?'Request not confirmed. You can retry using the same information.':error.message+' Puedes reintentar con los mismos datos.';}finally{busy=false;submit.disabled=false;}
  };applyReceptionLanguage();say(translations[receptionLang].welcome);
})();
