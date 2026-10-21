# Harness comercial vigente — Boltech Group

Actualización 21 octubre 2026. Prevalece AGENTS.md sobre los lotes y roles históricos. Hay exactamente dos agentes: Agente 1 de Ventas y Agente de Mercadeo.

## Operación

Agente 1 investiga 24/7, verifica fuentes oficiales y contactos, conserva oportunidades en Supabase y procesa contacto, respuestas y seguimiento por Gmail corporativo. No existe lote comercial obligatorio de cinco, ni meta total fija. Los presupuestos de tiempo y páginas son límites técnicos que dejan trabajo pendiente para el siguiente ciclo. Los módulos históricos con `five_lead_gate` o roles RSI-01/02/03 no gobiernan el recorrido canónico vigente.

Mercadeo recibe la necesidad de Agente 1 y prepara mensaje de prospección, seguimiento vinculado al hilo, preguntas de diagnóstico y explicación de la oferta aprobada. Ventas valida el material y registra uso solo con un mensaje Gmail real posterior a su preparación. Una respuesta del cliente es un resultado distinto de diagnóstico completado, propuesta, aceptación y pago. Las publicaciones apoyan el mismo segmento y tienen destino al diagnóstico escrito; no prueban demanda.

Cola única: `public.agent_work`, fichas `public.leads`, resumen estratégico `public.marketing_sales_briefs`, recepción `public.agent1_inbound_sales_jobs`. Propietarios MARKETING y AGENT1, una ficha por oportunidad y tarea idempotente por material/versión. Mercadeo no es un segundo emisor y no acepta contratos ni crea cobros.

## Ejecución y fuentes

Supabase pg_cron/pg_net activa las rutas existentes de investigación, inbox y Explee. Inbox procesa primero respuestas, luego seguimientos y contacto inicial; integra Mercadeo y actualiza su resumen. No añadir un temporizador de Mercadeo. El workflow manual de Mercadeo sirve para diagnóstico/recuperación del mismo código.

Fuentes de investigación según acceso y presupuesto: Explee Boltech 50656 y publicaciones públicas, Apollo/Upwork por adaptadores existentes cuando estén disponibles. Explee 51973 es el proyecto identificado como apiskey.online y no alimenta la cola Boltech. No consumir servicios pagados ni Connects sin autorización.

## Controles y prueba

Nombre, cargo, correo publicado, fuente oficial, MX y flujo observable antes del contacto inicial; presencia de un formulario no acredita dolor ni intención de compra. Historial, bajas, rebotes, duplicados, CRM actual, identidad del remitente y ventanas se vuelven a comprobar. Primer seguimiento a tres días calendario, incluidos fines de semana, según config/canonical_followups.json; respuesta/rechazo/baja lo cancela.

Reservar intención antes del envío, verificar proveedor y CRM después; resultado incierto se concilia sin reenviar a ciegas. Materiales anteriores e históricos permanecen consultables; no se les atribuyen uso o resultados retroactivos. Oferta solo desde config/commercial_pilot.json/commercial_offer.js. Wompi y pagos fuera de estas correcciones.

Módulos actuales: agent1_continuous_cycle, agent1_autonomous_inbox, canonical_outreach, canonical_followups, canonical_followup_sender, marketing_sales_support, marketing_trace y marketing_sales_cycle_v2. CI cubre los recorridos compartidos y los límites de atribución. Pruebas simuladas y despliegue READY no prueban respuesta, venta ni pago. Consultar recibos persistidos para el estado productivo y el protocolo de REGLA-DE-ORO.md antes de certificar entregas.
