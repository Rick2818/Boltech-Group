# Mercadeo autónomo y control comercial — contrato vigente

Versión: 2026-10-31. Sustituye la especificación antigua de campañas B2B de correo y RSI. Estado: la conexión de marketing→Agente 1 por Supabase está implementada; un tablero visual permanente no queda acreditado por este documento.

## Flujo exclusivo
1. **Agente 1:** busca trabajos verificables en Upwork y Freelancer.com (conexión real, sin scraping no autorizado), filtra duplicados, presupuesto, encaje, competencia, fecha, costo y elegibilidad. Si falta OAuth, registra bloqueo, no inventa.
2. **Mercadeo:** prepara propuestas individuales internas; adjunta capacidades, fases, preguntas y requisitos; registra prueba de lectura/escritura de `marketing_content_runs` con `sourceId`, `sourceUrl`, `workId`, `strategyVersion` y `publicationStatus:NOT_PUBLISHED`.
3. **Handoff:** el Agente 1 recibe `marketingContentId` y el estado `MARKETING_DRAFT_READY_FOR_REVIEW`; no sobrescribir trabajos que ya estén postulados, rechazados o cerrados.
4. **Aprobación:** solo el propietario autoriza envío, gasto de Connects y compromisos comerciales; guardar recibo real de plataforma antes de reportar postulación.
5. **Mercadeo institucional:** producir portafolio verificado, documentación, educación técnica ES/EN y piezas para LinkedIn institucional. Nunca atribuir ventas a vistas o borradores; publicar solo con permiso y recibo de proveedor.

## Indicadores de un tablero ES/EN autenticado
- Por plataforma: vistos, deduplicados, calificados, excluidos, bloqueados por OAuth, propuestas en borrador, borradores entregados, utilizados, aprobados y postulaciones aceptadas por proveedor.
- Por contenido: ID, tema/habilidad, versión, URL del trabajo, fecha, estado de revisión, handoff, aceptación y evidencia de uso.
- Resultados: respuestas, entrevistas, adjudicaciones y cobros confirmados, con sello temporal y atribución verificable.
- Infraestructura: cron activo, última ejecución, status HTTP, errores, OAuth, Governance, SHA de Vercel.
- Diferenciar **0** (medición válida sin eventos) de **N/D** (sin medición o falta de proveedor).

## Límites de certificación
Sin cold email, proveedores de bases de leads, nuevos RSI comerciales, envío de propuestas ni gasto de créditos. Conservar atención iniciada voluntariamente en web, cobros, pedidos y seguridad. No usar recibos sintéticos para tracción real. Los registros históricos se conservan con `RETIRED_LEGACY` para auditoría.

## Criterios de salida a producción
Pruebas de URLs genuinas, bloqueo de antigua tracción, estados enviados, idempotencia, handoff, credenciales ausentes, protección de servicios de web/pagos; Governance; Vercel READY en el commit fusionado; recibo real de Supabase. Autorización de OAuth de proveedores es gate independiente y debe marcarse BLOCKED si no funciona.
