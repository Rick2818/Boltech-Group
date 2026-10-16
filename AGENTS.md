# Instrucciones de Ricardo

## Regla de Oro 1 — Procedimiento lógico del harness

Por instrucción de Ricardo del 12 octubre 2026, esta es la primera regla general de trabajo: definir el resultado funcional antes de implementar, seguir una estructura lógica con responsables y decisiones claras, verificar recursos, probar el recorrido completo y documentar lo aprendido. El harness debe detectar desviaciones y recuperar el rumbo con evidencia, dentro de las instrucciones de mayor prioridad y los permisos vigentes.

Aplicar docs/architecture/HARNESS_WORKFLOW.md como procedimiento general: entender → recuperar contexto → comprobar recursos → diseñar → construir el recorrido mínimo → probar y corregir → publicar y verificar → entregar y aprender. La IA ayuda a razonar y ejecutar; evidencias, contratos y autorizaciones gobiernan los cambios. Reutilizar la guía en próximos proyectos y adaptarla a su criterio de éxito.

Por instrucción de Ricardo del 12 octubre 2026, usar docs/architecture/COMMERCIAL_HARNESS.md como estructura de referencia para esta app y como base portable para las siguientes apps comerciales. El harness debe leer estas reglas, comprobar el plan contra la arquitectura y reorientar cualquier desviación antes de ampliar la implementación.

Si una decisión no está documentada, contrastarla con la instrucción del usuario, el alcance autorizado y la Regla de Oro; registrar la decisión, responsable, razón, evidencia y criterio de aceptación. Resolver por criterio técnico los cambios reversibles dentro del alcance. Para una acción fuera de lo autorizado, preparar primero el resultado revisable y solicitar solo la autorización que falte. No confundir falta de documentación con falta automática de permiso.

Conservar roles existentes, un responsable por oportunidad y estado durable. IA analiza y propone; los permisos, precios, presupuesto, transiciones comerciales y confirmación de pago se validan con reglas y fuentes reales. No llamar funcionalidad validada a una preparación local, un despliegue READY o una prueba simulada. La imagen es un mapa; el documento y las pruebas son el contrato verificable. No prometer ausencia absoluta de fallos ni vender o entregar agentes sin el protocolo de la Regla de Oro.

## Regla de oro comercial del MicroSaaS

Leer y aplicar REGLA-DE-ORO.md antes de responder sobre el negocio, tomar decisiones importantes o verificar la operación. Conserva la misión y el protocolo comercial de Boltech; se aplica junto con la Regla de Oro 1 del harness, dentro de las instrucciones de mayor prioridad y los permisos disponibles.

Priorizar conseguir el primer pago real y repetirlo de forma predecible. Vender resultados concretos. Distinguir evidencia de supuestos; evaluar estrategia y riesgos; definir el siguiente paso con responsable, fecha y criterio de éxito. Cuestionar ideas cuando haya evidencia de un error. No declarar agentes listos ni entregarlos sin cumplir el protocolo y las pruebas del documento.

El documento recibido termina en el encabezado 5.4 sin contenido. Los campos entre corchetes siguen pendientes y no deben tratarse como datos confirmados. No inferir una programación automática ni autorización ilimitada para contactar a terceros.

## Contexto del usuario

El usuario se llama Ricardo, vive en El Salvador y trabaja con marketing digital, administración de empresas, IA, vibecoding y una pequeña empresa inmobiliaria. Tiene interés en Bitcoin como ahorro no tradicional y expresa apoyo al presidente Bukele. Estas son preferencias del usuario, no identidades ni opiniones personales del asistente.

## Mercadeo al servicio de ventas

Presupuesto confirmado por Ricardo el 7 octubre 2026 para conectar modelos de pago: USD0. No conectar APIs facturables, activar suscripciones ni consumo de modelos pagados sin nueva autorización expresa. Google ADK (@google/adk) orquesta los cuatro agentes existentes mediante BaseAgent y código; llamadas a Gemini deshabilitadas. La ruta RSI/n8n usa código, reglas y plantillas; no anunciar autonomía LLM independiente. Las definiciones históricas que indiquen modelos pagados no autorizan su uso.

Por instrucción de Ricardo del 7 octubre 2026, toda tarea de mercadeo debe responder a una necesidad concreta de RSI-01, RSI-02 o RSI-03 y acercar una oportunidad al pago. Aplicar docs/commercial/MERCADEO_APOYO_VENTAS.md. Reutilizar al responsable de mercadeo existente; su identidad/configuración debe verificarse antes de asignarle ejecución. No crear otro agente. Registrar solicitud, oportunidad o segmento, etapa, bloqueo, material solicitado, responsable, fecha y resultado comercial. Dirección prioriza cierres y respuestas con interés antes de adquisición nueva. Los materiales y publicaciones son entregables; su creación no equivale a demanda, envío, venta ni pago.

## Continuidad del equipo comercial

RSI-03 es responsable del cierre. Informa primero a Dirección de Ventas y Mercadeo; Dirección verifica la evidencia e informa a Ricardo. Distinguir aceptación, pago confirmado y entrega. Aplicar docs/commercial/N8N_COMUNICACION_VENTAS_MERCADEO.md para solicitudes y alternativas acotadas; no contabilizar un aviso de cierre como ingreso.

Ricardo exige reutilizar los tres agentes de ventas existentes RSI-01, RSI-02 y RSI-03. No crear agentes, automatizaciones, emisores ni calendarios duplicados. Revisar configuración, historial y bloqueos antes de reasignar funciones. Verificar si existe un agente de mercadeo antes de crear uno. Boltech vende solo agentes preelaborados y custom agents por cotización aprobada. No ofrecer llamadas, reuniones ni visitas: no hay personal para realizarlas. Ricardo dirige qué, cómo, cuándo y quién; los agentes realizan la operación autorizada. Ejecución técnica COMPLETED no equivale a prospección, respuesta, venta o pago. Objetivo comercial: primer pago real de cliente, excluyendo pruebas de cobro.


## Extensión de certificación de entregas (2026-10-15)

Aplicar también [`docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md`](docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md) para los roles E1–E4, GitHub Actions, Vercel, recuperación RSI y pruebas de aceptación. `INFRA_PASS` no es certificación del cliente; no afirmar ejecutores productivos ni trabajo entregado sin recibos reales.


## Evidencia ASMAS A1→A2 (15 octubre 2026)

Consultar [`docs/audits/ASMAS_SYNTHETIC_MAIL_RELAY_CERTIFICATION_20261015.md`](docs/audits/ASMAS_SYNTHETIC_MAIL_RELAY_CERTIFICATION_20261015.md): PR #78, GitHub Actions #38765754748 (15/15 PASS), exclusión del Cliente Sintético y traspaso de comprador simulado condicionado a aprobación. Verificar despliegue Vercel separadamente; estas pruebas no acreditan OAuth ni ventas reales.


## Gmail OAuth productivo — 15 octubre 2026, 21:13 SV

[Verificación de conexión y recuperación](docs/audits/GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md): renovación OAuth y perfil de `ricardo.boltechgroup@gmail.com` verificados contra producción; `CONNECTION_VERIFIED`, trabajo Actions [116791556010](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/job/116791556010), 13 pruebas aprobadas. Se actualizaron las tres variables OAuth y se redesplegó. Esta prueba no envió correos ni acredita campaña, traspaso comercial, entrega o venta. El indicador observado fue `automatedCampaignEnabled=false`. Reutilizar el workflow existente para futuras verificaciones y conservar los secretos solo en sus almacenes autorizados.


## Cliente Sintético — prueba final Gmail y roles, 15 octubre 2026

[Recibo y límites](docs/audits/SYNTHETIC_GMAIL_ALL_AGENTS_20261015.md): correo real enviado y recibido en Gmail Boltech, messageId `1a142b8b416b2fc3`; 108 pruebas locales de RSI-01/02/03, Mercadeo, Dirección y entrega aprobadas con proveedores simulados; CI de entrega 15/15 PASS y recuperación E4. No es un recorrido productivo único entre Gmail y todos los agentes. Mantener la exclusión sintética de oportunidades, cierres y pagos.
