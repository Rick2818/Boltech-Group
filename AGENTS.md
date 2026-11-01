# Boltech Group — Instrucciones operativas vigentes

**Versión y precedencia: 31 de octubre de 2026.** Este documento reemplaza cualquier instrucción comercial anterior que contradiga la estrategia aquí definida. Las versiones antiguas son historial, no permiso de ejecución.

## Arquitectura comercial

- **Agente 1 (Ventas):** descubre, deduplica, evalúa y documenta **únicamente** oportunidades de contratación en **Upwork** y **Freelancer.com**, mediante conectores oficiales/autorizados. Registra URL, ID del proyecto, fecha, presupuesto, condiciones, competencia, costo de Connects, encaje, próximos pasos y estado de postulación. Si un proveedor está desconectado, reporta el bloqueo; no simula resultados.
- **Mercadeo:** investiga demanda vinculada a oportunidades de esas plataformas; crea propuestas personalizadas **solo como borradores internos**, portafolio técnico verificable, material demostrativo claramente etiquetado, argumentos de valor, documentación, posicionamiento institucional y contenido educativo para la página empresarial de LinkedIn. Solo hay atribución cuando un material queda vinculado a una oportunidad concreta, leído por Ventas y utilizado con evidencia.
- **Atención web/Leo:** el cliente que contacta voluntariamente a Boltech puede recibir atención mediante la aplicación. Esta función no es prospección fría y no se suprime.
- **Pagos, pedidos y entrega:** conservar Wompi, cobros autorizados, trazabilidad, identidad y protección del cliente.

## Prohibiciones comerciales

- **Cold email suspendido indefinidamente.** No investigar correos empresariales, importar bases de prospectos para enviar mensajes, activar Apollo/Lusha/Explee/Instantly/Waalaxy, reanudar campañas SDR/Gmail ni automatizar seguimientos de la estrategia descartada.
- No enviar postulaciones, bids, mensajes en plataformas, correos comerciales, DMs ni gastar Connects, créditos o dinero sin aprobación explícita del titular.
- No activar antiguos RSI-01/02/03, múltiples vendedores, sus cron jobs ni la estrategia de captación externa por país/industria.
- Mantener las pruebas sintéticas separadas de operaciones y métricas reales. No inventar clientes, encajes, casos de éxito, beneficios ni ventas.

## Recorrido único verificable

1. Agente 1 identifica proyecto verificable en Upwork/Freelancer, lo evalúa y persiste un recibo en `agent_work` con prefijo `AGENT1:MARKETPLACE:`.
2. Mercadeo crea un borrador específico de la oportunidad en `marketing_content_runs`, estado `REVIEW_REQUIRED`, con `sourceId`, `sourceUrl`, `workId` y verificaciones de contenido.
3. Mercadeo verifica persistencia y registra `marketingContentId` en la ficha de Agente 1, sin modificar una postulación ya enviada ni adjudicarse ventas.
4. Agente 1 revisa alcance, costos y propuesta. Solo una autorización humana específica permite presentar una postulación.
5. El tablero distingue proyectos observados, elegibles, borradores, aprobaciones, postulaciones realmente presentadas, respuestas, adjudicaciones y pagos confirmados. Sin recibo del proveedor, estado desconocido.

## Automatización y despliegue

El programador de producción es Supabase Cron: `boltech-research` para Agente 1 y `boltech-marketing` para Mercadeo. No duplicar crons ni ejecutores. Los antiguos `boltech-inbox`, `boltech-explee`, `boltech-evidence` y validaciones de compradores de cold email están retirados. Los datos previos se conservan únicamente para auditoría, con estado `RETIRED_LEGACY`.

Antes de fusionar: validar sintaxis, pruebas de estrategia, Governance y despliegue Vercel asociado al commit, luego comprobar respuesta y recibos reales de Supabase. Un CI verde no equivale a ventas.

## Principios generales que se mantienen

Aplicar `REGLA-DE-ORO.md`, `.agents/rules/AGENTS.md`, el procedimiento del Harness y sus reglas de seguridad. No modificar pagos, secretos, precios, clientes, permisos o consumos sin necesidad y autorización; usar evidencia primaria y no prometer funcionalidad sin pruebas. Mantener servicios de atención web, soporte al comprador, pedidos y cobros independientes del cierre de cold email. Presupuesto adicional no autorizado: USD0.
