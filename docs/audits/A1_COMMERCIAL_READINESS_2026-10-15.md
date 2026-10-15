# Certificación operativa A1 — 15 octubre 2026

**Veredicto:** NO CERTIFICADO para realizar ciclo comercial autónomo completo. Evidencia no equivale a venta ni a autorización de enviar a cualquier contacto.

## Evidencia comprobada
- Repositorio `Rick2818/Boltech-Group`, cron `.github/workflows/asmas_rsi01_9am.yml` configurado para `0 15 * * *` (09:00 SV).
- Revisión de GitHub Actions 2026-10-15 ~15:27 UTC: ejecuciones del workflow observadas `pull_request` y `push`, ninguna `schedule` para las 09:00 SV de hoy en el historial consultado.
- Run `38661868343`, completado por `push` el 2026-10-15 00:45 UTC: job verde pero `RSI-01`, `RSI-02`, `RSI-03` con outcome BLOCKED. Evidencia `GMAIL_OAUTH_AUTH_FAILED`. Marketing COMPLETED. Salida de campaña: `reviewed=225`, `eligible=0`, `approvedTotal=0`, `cycleStatus=NO_APPROVED_LEADS`; cero envíos confirmados en ese ciclo.
- `lib/rsi01_research_executor.js`: verifica campos y registra evaluación, **no aprueba** outreach; `lib/sdr_campaign.js`: exige aprobación individual; `lib/sdr_dispatch.js`: límites, comprobaciones de historial, registro y reconciliación; `lib/sdr_gmail.js` autentica OAuth y verifica remitente.
- Vercel registra `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN` como secretos Production; existencia no certifica validez. Error de producción prueba bloqueo de intercambio OAuth.
- PR #74 propone no certificar automáticamente un workflow en verde cuando los agentes están bloqueados. Hasta fusionarlo y comprobar ejecución real, no atribuir corrección a producción.

## Gates para emitir certificado PASS
1. Cron auténtico `schedule` a las 09:00 SV, evidencia de GitHub run y acciones; confirmar hora y tolerancia a retrasos GitHub Actions.
2. A1 capta oportunidad REAL de Lusha, Upwork (postulaciones por la plataforma) u otra fuente sin créditos pagados; registro único Airtable con enlace, ICP, rol, evidencia y permisos.
3. Investigación técnica válida de empresa y necesidad; caso autorizado por responsable; exclusiones/bajas y duplicados conciliados con Apollo + Gmail + CRM.
4. Resolver `GMAIL_OAUTH_AUTH_FAILED` y verificar perfil de remitente desde el runtime Vercel con lectura, **sin enviar correo**.
5. Con destinatario realmente autorizado, comprobar remitente, cuota, estado y deduplicación; realizar un solo envío comercial explícitamente autorizado, registrar `messageId` y verificar en Gmail, CRM y bitácora; respuesta incierta = HOLD/reconciliar, nunca reintento a ciegas.
6. Observabilidad por etapa con razón de bloqueo, recuperación RSI evidence-gated, tests CI + corrida real, 0 cobros innecesarios, sin falsas ventas.

**No debe publicarse estado CERTIFICADO hasta satisfacer 1–6 con evidencia.** El informe de actividad comercial diario es independiente de esta certificación y no sustituye esos controles.
