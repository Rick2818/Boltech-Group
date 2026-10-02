# Vigilancia de producción y detalle privado

## Horarios y evidencia

GitHub ejecuta boltech_health_check.yml cada hora en el minuto 17 y conserva 06:30 SV de lunes a viernes. MIT conserva 09:00 SV. Cron está en UTC, El Salvador es UTC-6. GitHub reconoce posibles retrasos y omisiones: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule . No se promete puntualidad garantizada.

El 1 de octubre health se creó a 12:29:43 SV y planner a 12:40:32 SV. MIT de 29 y 30 de septiembre se creó aproximadamente a 13:54 SV. El retraso ocurrió antes de comenzar el runner; no se probó su causa interna. El conector no permitió leer el endpoint workflows para confirmar estado habilitado. Se usa evidencia de runs, sin inventar estado.

## Comprobaciones

Sitio, agent card, rechazo A2A sin credenciales, Telegram deep health con cola pendiente, protección de métricas/readiness, almacenamiento autenticado y configuración de pagos. El historial de GitHub se lee con GITHUB_TOKEN, actions:read. Detecta jobs diarios ausentes después de 60 minutos de tolerancia, retrasos superiores a 60 minutos y cobertura horaria más antigua que 150 minutos.

Errores de red, autenticación, almacenamiento o exposición de datos: FAILED y salida no cero. Anomalías de horario: ATTENTION y alerta mediante vigilancia independiente. Pagos: PROVIDER_VERIFICATION_PENDING aunque las credenciales estén configuradas. No ejecuta pagos, crea referrals, envía mensajes ni reintenta operaciones comerciales.

A2A_MONITOR_TOKEN solo debe contener una credencial emitida a un partner realmente aprobado. Un método no soportado sin efectos confirma autenticación antes de su rechazo; no acredita entrega completa. Si falta credencial: PENDING. No crear partners ficticios ni reutilizar token administrativo como token A2A.

## Endpoints privados

Health público de partners solo informa disponibilidad. Readiness público de pagos indica VERIFICATION_REQUIRED. No publican IDs, configuración ni finanzas.

metrics y health-internal de partners, readiness-internal de pagos requieren Authorization Bearer con PARTNER_API_TOKEN o COCKPIT_ACCESS_TOKEN existentes. Ausente/incorrecto: 401; runtime sin secreto: 503. El token A2A del partner no da acceso global administrativo. Panel y jobs se adaptaron; desconectar borra cifras y listas del navegador.

PARTNER_API_TOKEN debe estar en GitHub Secrets para diagnóstico interno. No se copian ni publican secretos. Si falta, el monitor falla de forma visible. La aprobación de un partner no concede acceso administrativo global.

## Control independiente y activación

La revisión horaria de ChatGPT inspecciona GitHub y Vercel y alerta aquí por fallos, falta de ejecuciones o retrasos. Evita duplicar incidencias conocidas. No depende de la laptop ni del scheduler de GitHub y tampoco ofrece SLA de puntualidad. Telegram deep comprueba proveedor/webhook, no una conversación completa; no se afirma un canal de alertas por Telegram probado.

Con un partner aprobado: comprobar aprobación y alcance, registrar evidencia privada, emitir credencial con mínimo privilegio mediante proceso autorizado, configurar secreto seguro y probar autenticación, atribución, consentimiento y reintentos con datos autorizados. Estos pasos quedan pendientes hasta tener aprobación y credencial genuinas. No entregar el token administrativo global al partner.

## Trazabilidad del cron y artefactos (2 de octubre de 2026)

El título de cada nueva ejecución muestra github.event.schedule o el tipo de evento. El resumen y production-health.json guardan trigger.event, schedule, kind, runId y artifactName; solo se admiten los cron conocidos y un ID numérico. Un evento desconocido no se atribuye por proximidad horaria.

El artefacto se llama production-health-<run_id>, contiene production-health.json y se conserva 14 días. La vigilancia independiente debe listar todos los artefactos de la ejecución (sin filtro de nombre), buscar el nombre exacto con ese ID y comprobar expired=false. No buscar únicamente production-health. No declarar ausencia por un error del conector o por una ejecución aún en curso; informar evidencia no disponible y reconsultar antes de alertar. Puede leer trigger en el artefacto para distinguir el cron. Las ejecuciones anteriores a este cambio no permiten atribución retroactiva si sus logs no registraron el activador.

Corrección de la revisión anterior: la ejecución 37008334357 sí publicó production-health-37008334357, ID 11226372451, el 2 de octubre a las 06:43 SV.

## Salud Wompi en ambos sentidos

Readiness interno ejecuta OAuth y GET /Aplicativo desde Vercel y devuelve solo wompiConnection y wompiHealthContractVersion=2. La vigilancia comprueba conexión y modo productivo, GET del webhook rechazado con 405 y POST con firma deliberadamente inválida rechazado con 401 antes de almacenamiento. Estas pruebas negativas vienen del monitor, no de Wompi; no prueban recepción de un callback genuino. Los webhooks sin autenticación se rechazan en la frontera de API; los firmados conservan su conciliación y trazabilidad.

Los checks wompi_connection, wompi_environment, wompi_webhook_method y wompi_webhook_signature tienen estado propio. wompi_payment_end_to_end conserva PENDING hasta prueba controlada con un webhook real, importe y ambiente correctos, conciliación, duplicados y entrega. No confundir entorno productivo con cobro/abono bancario verificado. No se crean enlaces, cargos ni eventos persistentes con las sondas negativas.
