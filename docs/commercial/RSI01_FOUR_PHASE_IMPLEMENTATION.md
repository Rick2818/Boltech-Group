# Plan y ejecución comercial RSI-01 (2026-10-17)

## Objetivo
Cinco oportunidades justificadas por día, sin fabricar señales ni exigir respuesta previa antes del primer contacto **autorizado**.

## Fase 1 — Descubrimiento
El ciclo RSI-01 examina Leads del CRM y genera un trabajo para empresas con URL HTTPS cuyo dominio corresponde al correo empresarial, sin tarea previa, respetando bajas/exclusiones. Límite: cinco nuevas tareas por ciclo. Aún NO descubre empresas ajenas al CRM ni consume motores de búsqueda externos; necesitará proveedor/índice autorizado con cobertura comprobada.

## Fase 2 — Investigación
El investigador inspecciona la portada y hasta tres subpáginas del mismo dominio; extrae URL, fragmento y categoría de señal operacional. No infiere dolor confirmado. Procesa hasta cinco casos por ciclo, priorizando sitios verificables. Casos retry pueden volver a investigarse sin duplicación durante un mismo día.

## Fase 3 — Preparación para ventas
Cada valoración produce `reviewPacket` con señales documentadas, comprador/ contacto presentes, necesidad confirmada solo si cliente la afirmó, y estado REVIEW_REQUIRED/INSUFFICIENT_EVIDENCE. Es un expediente **no aprobado** en RSI Agent Work. No crea `SDR_CANDIDATE_V1` con READY_FOR_CONTACT, no activa correo y conserva el proceso de revisión individual existente. El sistema no inventa autorización.

## Fase 4 — Ejecución
Utiliza el workflow GitHub Actions existente y endpoint Vercel; registra `RSI01_CRM_DISCOVERY` y `RSI01_RESEARCH_ASSESSMENT` con conteos. El ledger Redis del día no debe reiniciar envíos ni duplicar trabajos. Que la campaña retorne NO_APPROVED_LEADS significa falta de contactos autorizados, no que falle la búsqueda técnica. Revisar siempre ambos recibos por separado.

## Aceptación productiva
Requiere workflow aprobado, Vercel READY con SHA correcto y un recibo real de Agent 1 mostrando fuentes obtenidas. Si no hay cinco oportunidades justificadas, reportar número real y razón. Wompi y envíos comerciales intactos.
