# Mercadeo → Agente 1: trabajo vigente de Boltech Group

**Versión 31-10-2026. Sustituye las instrucciones de octubre basadas en RSI y campañas por correo.**

## Objetivo compartido
Conseguir contratos reales prestando servicios de agentes IA, automatización n8n, integraciones API, CRM, Supabase y chatbots mediante **Upwork y Freelancer.com**. Agente 1 hace investigación de solo lectura; Mercadeo prepara materiales específicos para mejorar la calidad de cada posible postulación. Nada de cold email.

| Etapa | Agente 1 | Mercadeo | Evidencia |
|---|---|---|---|
| Descubrimiento | Verifica anuncio, fecha, URL, presupuesto y cliente en la plataforma | Prioriza problemas y capacidades relevantes | Recibo de `agent_work` |
| Calificación | Analiza encaje, esfuerzo, competencia, requisitos y Connects | Aporta material técnico y diferenciación con respaldo | Evaluación de proyecto, no un email de prospecto |
| Preparación | Selecciona proyectos que ameritan postularse | Redacta borrador individualizado, preguntas y fases de trabajo | `marketing_content_runs` con `workId`, `sourceId`, `sourceUrl` |
| Entrega interna | Lee material y decide siguiente paso | Verifica persistencia y enlaza `marketingContentId` | Estado `MARKETING_DRAFT_READY_FOR_REVIEW` |
| Postulación | Requiere aprobación humana antes de enviar o gastar | Ajusta únicamente el borrador | Recibo genuino de Upwork/Freelancer, no inferencia |
| Resultado | Registra respuesta, adjudicación y cobro | Mide adopción y mejoras del material | Recibos proveedor + atribución comprobada |

## Mercadeo institucional independiente
Producir briefs, documentación, argumentos de valor, mini-demos etiquetadas, piezas educativas ES/EN y propuestas de contenido para **LinkedIn institucional**. No utilizar la cuenta personal. La publicación requiere permisos y comprobante real; no se reporta como venta. El tema y el mensaje deben corresponder a los servicios por los que Boltech compite, no a una lista de empresas estadounidenses para correos.

## Prohibiciones y límites
No usar Apollo, Lusha, Explee, Instantly, Waalaxy, cold email, campañas SDR, scraping no aprobado ni bases de correos. No hacer bids, propuestas, DMs o gastos sin autorización específica. No reactivar agentes vendedores históricos RSI-01/02/03, inventar casos de éxito, cotizar sin alcance ni usar simulaciones como pruebas comerciales. **La atención voluntaria al cliente de la web, pedidos y cobros siguen operativos por separado.**

## Control de datos
Medir por plataforma: proyectos identificados, nuevos/duplicados, filtros de elegibilidad, borradores producidos, handoffs comprobados, borradores usados, postulaciones verificadas, respuestas, contrataciones, valor del contrato y cobros. Cada contador debe señalar origen y fecha, con cero o N/D cuando falte evidencia. Los 40 materiales históricos `SALES_HANDOFF` y el brief `managed-ai-operations-v2-us-b2b` están retirados en Supabase con preservación de auditoría.

## Continuidad
El único programador de producción usa `boltech-research` (Agente 1) y `boltech-marketing` (Mercadeo) en Supabase. El acceso de Upwork para Vercel y OAuth de Freelancer.com deben validarse; si están bloqueados, registrar error explícito y utilizar únicamente las herramientas conectadas realmente disponibles, sin fabricar investigación.
