import {orientReception,receptionSteps} from './reception-guidance.js';
(() => {
  const style=document.createElement('link');style.rel='stylesheet';style.href='/assets/css/web-reception.css';document.head.append(style);
  const root=document.createElement('aside');root.id='web-reception';root.setAttribute('aria-label','Asistente de Boltech');
  root.innerHTML=`<button type="button" class="reception-launch" aria-expanded="false" aria-controls="reception-panel">¿Qué necesitas automatizar?</button>
  <section id="reception-panel" hidden aria-label="Orientación comercial"><header><div><strong>Asistente de Boltech</strong><small>Orientación y recepción de solicitudes</small></div><button type="button" class="reception-close" aria-label="Cerrar">×</button></header>
  <p class="reception-intro">Te ayudo a definir el siguiente paso. Soy un asistente guiado; los casos especiales pasan a revisión.</p>
  <div class="reception-log" role="log" aria-live="polite"></div><form class="reception-form"><label class="reception-question" for="reception-answer"></label><input id="reception-answer" maxlength="1000" required autocomplete="off"><label class="reception-consent" hidden><input type="checkbox"> Autorizo a Boltech a contactarme por correo sobre esta solicitud.</label><button type="submit">Continuar →</button></form>
  <button type="button" class="reception-scope">¿Qué ofrecen y cuánto cuesta?</button><p class="reception-status" role="status"></p></section>`;
  document.body.append(root);
  const panel=root.querySelector('section'),launch=root.querySelector('.reception-launch'),form=root.querySelector('form'),answer=root.querySelector('#reception-answer'),question=root.querySelector('.reception-question'),log=root.querySelector('.reception-log'),status=root.querySelector('.reception-status'),consent=root.querySelector('.reception-consent'),submit=form.querySelector('button');
  const steps=receptionSteps;
  let step=0,busy=false;const values={};
  function say(text,who='Boltech'){const p=document.createElement('p');p.textContent=`${who}: ${text}`;log.append(p);log.scrollTop=log.scrollHeight;}
  function render(){const s=steps[step];question.textContent=s[1];answer.type=s[2];answer.maxLength=s[3];answer.value=values[s[0]]||'';consent.hidden=step!==steps.length-1;submit.textContent=step===steps.length-1?'Registrar mi solicitud →':'Continuar →';}
  function close(){panel.hidden=true;launch.setAttribute('aria-expanded','false');launch.focus();}
  launch.onclick=()=>{panel.hidden=!panel.hidden;launch.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)answer.focus();};root.querySelector('.reception-close').onclick=close;
  root.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  root.querySelector('.reception-scope').onclick=()=>say('Ofrecemos agentes preelaborados y a medida. El piloto de registro y seguimiento cuesta US$990: una empresa, un flujo web y una integración sencilla; herramientas y mantenimiento aparte. Otros procesos requieren evaluación y cotización aprobada. No ofrecemos llamadas ni prometemos ventas.');
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const value=answer.value.trim();if(!value || (step===0 && value.length<4)){status.textContent='Describe un poco más el proceso.';return;}values[steps[step][0]]=value;status.textContent='';
    if(step<steps.length-1){say(value,'Tú');if(step===0)say(orientReception(value));if(step===6)say('Con estas respuestas podemos evaluar el alcance y las integraciones. RSI-01 revisará el caso y RSI-02 validará la solución; aún no hay precio ni viabilidad aprobados para este proceso.');step++;render();answer.focus();return;}
    if(!consent.querySelector('input').checked){status.textContent='Autoriza el contacto para registrar tu solicitud.';return;}
    busy=true;submit.disabled=true;status.textContent='Guardando tu solicitud…';
    try{const response=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,source:'RSI01_WEB',consent:true})});const data=await response.json();
      if(!response.ok || data.success!==true || data.registration?.status!=='RECORDED' || data.assignment?.owner!=='RSI-01')throw Error(data.error||'No se confirmó el registro.');
      form.hidden=true;status.textContent=`Solicitud registrada. Referencia: ${data.registration.requestId}. RSI-01 revisará tu necesidad para continuar por correo. El seguimiento está pendiente; este registro no confirma una cotización ni un pago.`;
    }catch(error){status.textContent=error.message+' Puedes reintentar con los mismos datos.';}finally{busy=false;submit.disabled=false;}
  };render();say('Cuéntame qué quieres mejorar. No compartas contraseñas ni datos privados de tus clientes.');
})();
