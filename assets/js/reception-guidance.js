// Bounded guidance from the customer's statement; never an approved scope or promise.
export function orientReception(pain,language='es') {
  const text=String(pain).toLowerCase();
  if(language==='en') {
    if(/cotiza|consulta|lead|solicitud|seguimiento|cliente|inquir|follow.?up/.test(text)) return 'We could help record inquiries, assign an owner and retain the next action. First, I need to understand how a request arrives and is handled today.';
    if(/excel|hoja|document|pdf|factura|copiar|dato|sheet|invoice/.test(text)) return 'We could assess an agent that organizes information and prepares records for review. Formats, tools and rules need verification before confirming feasibility.';
    return 'We can assess an agent to reduce repetitive steps and make pending work visible. First, I need to understand the process and the decisions that require human approval.';
  }
  if(/cotiza|consulta|lead|solicitud|seguimiento|cliente|inquir|follow.?up/.test(text))
    return 'Podríamos ayudarte a registrar cada consulta, asignar un responsable y conservar la próxima acción. Para saber si resuelve tu caso, necesito entender cómo llega y se atiende hoy una solicitud.';
  if(/excel|hoja|document|pdf|factura|copiar|dato|sheet|invoice/.test(text))
    return 'Podríamos evaluar un agente que organice información y prepare registros o documentos para revisión. Debemos comprobar formatos, herramientas y reglas antes de confirmar que puede hacerlo.';
  return 'Podemos evaluar un agente para reducir pasos repetitivos y hacer visibles los pendientes. Primero necesito conocer el proceso; si requiere decisiones humanas, las mantendremos bajo tu control.';
}
export const receptionSteps=[
  ['painPoint','¿Qué problema te está costando tiempo, dinero o clientes?','text',1000],
  ['workflow','¿Cómo sucede hoy, paso a paso, desde que comienza hasta que se resuelve?','text',1000],
  ['impact','¿Cuánto tiempo, dinero u oportunidades pierdes? Una estimación es suficiente.','text',500],
  ['tools','¿Qué herramientas y datos usas? No compartas contraseñas ni datos privados.','text',200],
  ['decision','¿Quién participa y decide? ¿Qué acciones deben conservar aprobación humana?','text',500],
  ['result','¿Qué resultado medible necesitas conseguir y para cuándo?','text',500],
  ['limits','¿Qué no debe hacer nunca el agente?','text',500],
  ['companyName','¿Cómo se llama tu empresa?','text',120],
  ['email','¿A qué correo podemos responderte sobre esta necesidad?','email',254]
];
export const receptionStepsEn=receptionSteps.map((s,i)=>[s[0],[
  'What problem is costing you time, money or customers?',
  'How does it happen today, step by step, from start to resolution?',
  'How much time, money or opportunity do you lose? An estimate is enough.',
  'Which tools and data do you use? Do not share passwords or private data.',
  'Who participates and decides? Which actions require human approval?',
  'What measurable result do you need, and by when?',
  'What must the agent never do?',
  'What is your business called?',
  'Which email can we use to respond about this request?'
][i],s[2],s[3]]);
