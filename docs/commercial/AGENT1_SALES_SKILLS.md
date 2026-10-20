# Cinco habilidades de ventas del Agente 1

Versión 1, 20 octubre 2026. Resultado: investigar fuentes disponibles, preparar exactamente cinco empresas distintas con evidencia y revisar respuestas mediante el coordinador existente. No crea agentes, cron, emisores, dependencias ni consumo de modelos. Wompi y precios permanecen fuera de este cambio.

| Habilidad | Aplicación ejecutable |
| --- | --- |
| `agent1-icp-targeting` | `planSearch` define búsqueda acotada; `prepare` verifica identidad y mercado, excluye QA y bajas |
| `agent1-buying-signal-research` | `planSearch` alimenta consultas reales; `prepare` exige proceso y contacto publicados en el dominio oficial |
| `agent1-bant-qualification` | `prepare` registra presupuesto, autoridad, necesidad y plazo como UNKNOWN; no acredita comprador calificado |
| `agent1-personalized-outreach` | `prepare` selecciona asunto y pregunta según el proceso; no copia instrucciones de páginas ni promete ROI |
| `agent1-followup-handoff` | `reviewFollowup` clasifica rebote, baja, respuesta automática o respuesta para Agente 2 |

El registro de enlaces es `config/agent1_sales_skills.json`; el ejecutor es `lib/agent1_sales_skills.js`. Son reglas y plantillas deterministas, no ejecución LLM de Markdown. Las cinco carpetas `.agents/skills/agent1-*` aportan instrucciones para operadores y agentes de desarrollo; la versión desplegable es el código enlazado.

## Ejecución y continuidad

- `rsi_agent_executor.js` registra el plan en el recibo del ciclo. Los adaptadores existentes de Upwork y n8n se ejecutan independientemente; la búsqueda pública HN usa las consultas de la habilidad y continúa tras errores. Acceso bloqueado queda visible. Apollo no es requisito para descubrir señales en otras fuentes.
- `rsi01_lead_preparation.js` ejecuta las primeras cuatro habilidades después de verificar identidad Gmail, inventario Apollo completo, historial y MX. Guarda calificación y recibo de habilidades en el candidato CRM; exige lectura de confirmación. Redis `boltech:rsi01:five:YYYY-MM-DD` conserva seleccionados, rechazos y reintentos. Retoma una investigación por invocación, deduplica dominios y se detiene en cinco.
- `rsi01_followups.js` usa la quinta habilidad después de conciliar mensajes. Mantiene reserva durable, exclusión mutua, ventana, cadencia, recibo real y traspaso existente al Agente 2. Una respuesta no acredita necesidad ni venta. BANT posterior corresponde a la calificación escrita de Agente 2, no a inferencia automática.
- Se reutiliza `.github/workflows/asmas_rsi01_9am.yml`, con investigación/preparación y despacho sujetos a sus compuertas existentes. No se añade otra programación. Este cambio no activa campañas de Instantly.

## Límites que deben permanecer visibles

Las señales públicas no son leads completos. Si falta empresa/contacto verificable, quedan en investigación. Falta de acceso a Gmail/Apollo impide declarar historial limpio y puede bloquear la preparación aunque otras fuentes sigan investigándose. Inventario agotado se declara BLOCKED, sin fabricar cinco resultados. Cambiar fuentes no permite eludir permisos de plataforma, comprar créditos ni sustituir historial faltante.

La autonomía implementada es técnica y acotada: búsqueda, verificaciones, guardado, recuperación y clasificación. Las pruebas con proveedores simulados validan lógica, no acreditan un recorrido comercial productivo independiente ni recepción en Unibox. La conexión Gmail a Instantly y el test interno están documentados separadamente en `docs/audits/INSTANTLY_GMAIL_CONNECTION_20261019.md`. Mantener Instantly pausado hasta completar pruebas pendientes.

## Verificación reproducible

`node --test tests/test_sdr_dispatch.mjs tests/test_agent1_sales_skills.mjs tests/test_rsi01_lead_preparation.mjs tests/test_rsi01_external_discovery.mjs tests/test_rsi01_platform_sources.mjs tests/test_rsi01_followups.mjs tests/test_rsi_agent_executor.mjs tests/test_rsi01_daily_campaign.mjs tests/test_campaign_workflow_sequence.mjs tests/test_followup_work_sync.mjs`

Las pruebas cubren enlaces, fuentes alternativas tras error, calificación desconocida, evidencia oficial, MX, bajas, rebotes, mensajes personalizados, cinco distintos, reanudación y protección frente a reenvíos. Confirmar despliegue y recibos de proveedores por separado antes de declarar autonomía productiva certificada.


## Condiciones autorizadas — 19 octubre 2026
Ricardo solicita incorporar las condiciones al Agente 1 en main. Reutilizar el ejecutor existente y `config/commercial_pilot.json`; no crear otro agente, temporizador o emisor. `planSearch` y `prepare` incluyen `commercialTerms`; `commercialTerms({discountPercent})` calcula importes para una propuesta, sin enviar ni cobrar.

Precio piloto vigente: USD990; con 10% de descuento: USD891, anticipo USD445.50 y saldo USD445.50. Sin descuento: USD495 + USD495. Descuento máximo autorizado: 10%, no acumulable. Pago: 50% antes de comenzar y 50% al terminar contra criterios de entrega verificados. El plazo comienza con aceptación, anticipo confirmado y accesos disponibles. Las cotizaciones ya aceptadas no cambian. Otros agentes preelaborados y a medida requieren su precio aprobado; USD990 no es una tarifa universal.

Alcance significa qué compra el cliente: resultado, funciones, plataformas, entregables, plazo, criterios de aceptación y exclusiones. El piloto existente incluye una empresa, un flujo web y una integración sencilla: registro, referencia, asignación de responsable y próxima acción; documentación y transferencia de uso. Excluye herramientas/consumo, mantenimiento e integraciones adicionales. Confirmar viabilidad por caso antes de comprometerse; ampliar alcance requiere nueva cotización. No ofrecer llamadas ni reuniones.

Flujo mínimo: configuración aprobada → Agente 1 consulta condiciones → prepara información y entrega al responsable vigente → propuesta individual → aceptación y cobro por canales existentes. Responsable técnico: ejecutor central; presupuesto adicional USD0. Verificar cálculo, límite de descuento y consumo desde Agente 1; conservar pruebas de cierre existentes. No modificar Wompi ni órdenes. Revertir este commit restaura únicamente la política y guía nuevas, sin alterar cotizaciones aceptadas.

Verificación de portada publicada (19 octubre): USD990 figura como implementación de pago único; no se observa tarifa mensual. `recurringAmount:null` significa pendiente de cotización, no mensualidad gratuita. Separar las mensualidades de la implementación y no extenderles descuento/50-50 sin condiciones aprobadas. No reutilizar planes retirados.

Validación local: 31 pruebas aprobadas en términos comerciales, skills de Agente 1, rutas, apoyo de mercadeo y cierre simulado. No acredita despliegue ni cobro real.

Aclaración expresa de Ricardo (19 octubre): las mensualidades se pagan completas, sin dividir. La regla 50/50 se aplica únicamente a implementación.

Última instrucción de Ricardo (19 octubre): trabajar únicamente con el piloto USD990 y el descuento autorizado hasta 10%; no ofrecer mensualidades ni otros precios. Prevalece sobre la búsqueda de otras tarifas.
