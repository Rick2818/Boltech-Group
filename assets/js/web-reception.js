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
      if(transcript){answer.value=[answer.value.trim(),transcript].filter(Boolean).join(' ');answer.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Texto dictado. Revísalo y presiona Continuar.';}
    };
    recognition.onerror=event=>{status.textContent=event.error==='not-allowed'?'Permite el acceso al micrófono en tu navegador.':'No se pudo reconocer la voz. Puedes escribir tu respuesta.';};
    recognition.onend=()=>{listening=false;mic.setAttribute('aria-pressed','false');mic.textContent='🎙 Hablar';};
    mic.onclick=()=>{if(listening){recognition.stop();return;}try{recognition.lang=voiceLanguage.value;recognition.start();listening=true;mic.setAttribute('aria-pressed','true');mic.textContent='■ Detener';status.textContent='Escuchando…';}catch{status.textContent='No se pudo iniciar el micrófono.';}};
  }
  const campaignParams=new URLSearchParams(window.location.search);
  const campaignAttribution={utm_source:campaignParams.get('utm_source'),utm_medium:campaignParams.get('utm_medium'),utm_campaign:campaignParams.get('utm_campaign')};
  let step=0,busy=false;const values={};
  function say(text,who='Boltech'){const p=document.createElement('p');p.textContent=`${who}: ${text}`;log.append(p);log.scrollTop=log.scrollHeight;}
  function render(){const s=steps[step];question.textContent=s[1];answer.type=s[2];answer.maxLength=s[3];answer.value=values[s[0]]||'';consent.hidden=step!==steps.length-1;submit.textContent=step===steps.length-1?'Solicitar mi propuesta →':'Continuar →';}
  function close(){if(listening)recognition?.stop();panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus();}
  launch.onclick=()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)answer.focus();};root.querySelector('.reception-close').onclick=close;
  root.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  root.querySelector('.reception-scope').onclick=()=>say(receptionPricing);
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const value=answer.value.trim();if(!value || (step===0 && value.length<4)){status.textContent='Describe un poco más el proceso.';return;}values[steps[step][0]]=value;status.textContent='';
    if(step<steps.length-1){say(value,'Tú');if(step===0)say(orientReception(value));if(steps[step][0]==='limits')say(recommendReception(values).text);step++;render();answer.focus();return;}
    if(!consent.querySelector('input').checked){status.textContent='Autoriza el contacto para registrar tu solicitud.';return;}
    busy=true;submit.disabled=true;status.textContent='Guardando tu solicitud…';
    try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,...campaignAttribution,source:'RSI01_WEB',consent:true})});const data=await response.json();
      if(!response.ok || data.success!==true || data.registration?.status!=='RECORDED' || data.assignment?.owner!=='RSI-01')throw Error(data.error||'No se confirmó el registro.');
      form.hidden=true;status.textContent=`Solicitud registrada. Referencia: ${data.registration.requestId}. Recibimos tu necesidad y tu preferencia de compra para preparar la propuesta por correo. La revisión comercial está pendiente; aún no has contratado ni pagado.`;
    }catch(error){status.textContent=error.message+' Puedes reintentar con los mismos datos.';}finally{busy=false;submit.disabled=false;}
  };render();say('Cuéntame qué quieres mejorar. No compartas contraseñas ni datos privados de tus clientes.');
})();
