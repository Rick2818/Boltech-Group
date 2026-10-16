# Gmail OAuth — conexión productiva verificada

Fecha: 15 octubre 2026, 21:13:46 America/El_Salvador (2026-10-16T03:13:46.679Z).
Responsable: ChatGPT / Codex; renovación y carga de credenciales realizada por Ricardo.
Resultado: **CONNECTION_VERIFIED**, exclusivamente para autenticación OAuth y lectura del perfil remitente.

## Evidencia

- [GitHub Actions: trabajo de verificación](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/job/116791556010).
- [Recibo JSON como artifact](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/artifacts/12022287403).
- Workflow reutilizado: `.github/workflows/sdr_connection_verification.yml`.
- Probe: `scripts/ops/verify_sdr_production.mjs`; destino productivo `https://boltech-group.vercel.app/api/partners`.
- Resultado real: `google.success=true`, `google.verified=true`, remitente `ricardo.boltechgroup@gmail.com`.
- Configuración observada: `configured=true`, `missing=[]`, `storageConfigured=true`, `crmConfigured=true`.
- Pruebas del workflow: 13 aprobadas, 0 fallidas. El workflow reejecutado utiliza el commit histórico `b7b42ffc2d97105beea36af2422df375fd89f44d`; el probe consulta la API de producción actual, no despliega ese commit.
- Código productivo durante la comprobación: main `739fbaea19815b58d19830344c9043ff4558b72a`. Vercel consultado después: `dpl_AjtVejTQsPwT2vQW1MdUGtinfTBx`, READY, Production; URL `boltech-group-9f6gtc8uc-rick2818s-projects.vercel.app`. El recibo del probe no devuelve el SHA del servidor; no representa una atestación automática de coincidencia de commits.

## Reparación y aprendizaje

Las variables `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` y `GMAIL_OAUTH_REFRESH_TOKEN` se actualizaron en Production y se redesplegó. Dos comprobaciones previas fallaron con `GMAIL_OAUTH_AUTH_FAILED`: trabajos [116786561850](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/job/116786561850) y [116789154327](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/job/116789154327). Después de volver a copiar Client ID y Client secret desde el Playground que renovaba correctamente, la comprobación pasó. No se determinó cuál de los valores anteriores era incorrecto.

Procedimiento reutilizable: comprobar el conjunto de credenciales en Playground mediante **Refresh access token**; copiar cada campo completo en su variable correspondiente; guardar en el entorno correcto; redesplegar; ejecutar la verificación autenticada existente y leer el recibo. No reutilizar el código de autorización con el botón de intercambio ni confundir access token con refresh token. Nunca guardar valores secretos en Git, capturas o logs del harness.

## Alcance y pendientes

Esta prueba no envió correos, no verificó entrega, respuestas, traspaso entre agentes, campaña completa ni cobros. El resultado observó `automatedCampaignEnabled=false` y cero trabajos SDR registrados; estos ceros corresponden exclusivamente al ledger SDR y no al historial total de Gmail. Las banderas de Redis/CRM confirman configuración; no certifican su recorrido completo.

Próximo criterio comercial: ejecutar la prueba de envío y conciliación autorizada con Cliente Sintético por el flujo existente, con recibo del proveedor y exclusión de métricas comerciales. No activar campañas, emisores o calendarios adicionales por este registro. Verificar por separado el estado de publicación/consentimiento de Google y la vigencia futura del refresh token; un éxito puntual no garantiza operación continua.
