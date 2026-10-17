# Gmail OAuth: certificación técnica y vigilancia de continuidad

Fecha: 17 octubre 2026. Responsable técnico: Codex, por solicitud de Ricardo.

## Resultado y criterio de aceptación

Objetivo: comprobar que Gmail corporativo renueva el acceso y detectar regresiones con el monitor existente, sin envío de correo ni otro ejecutor. Flujo: GitHub Production Health Watch → endpoint privado `sdr-verify` en Vercel → intercambio OAuth → perfil Gmail → recibo saneado de éxito o fallo.

Se reutilizan aplicación, autorización operativa y cron existentes; presupuesto adicional USD0. Riesgos: revocación por Google o usuario, credenciales equivocadas, caída de red y retrasos de GitHub Actions. Ninguna prueba demuestra ausencia futura de fallos. Rollback: revertir este cambio; no reemplazar secretos ni repetir mensajes como recuperación automática.

## Evidencia real previa al endurecimiento

La renovación y el perfil corporativo pasaron en producción el 17 octubre a las 15:03:09Z (09:03 SV), commit `52490d620c33704f5de7ed78bc23b069a99732a9`, con 21 pruebas aprobadas y `CONNECTION_VERIFIED` en [Actions, intento 3](https://github.com/Rick2818/Boltech-Group/actions/runs/39039232102/attempts/3). No se enviaron correos. El token anterior devolvía `invalid_grant`, categoría `TOKEN_EXPIRED_OR_REVOKED`; Google no identificó la causa individual y no se atribuye a una hipótesis.

## Protecciones verificadas con proveedores simulados

| Prueba | Resultado esperado y observado localmente |
|---|---|
| Access token válido, dos lecturas | Reutiliza acceso vigente, un intercambio |
| Adelantar reloj una hora | Renueva automáticamente con el refresh token original; no requiere nuevo refresh token en la respuesta |
| Revocación al renovar | Falla antes de otra lectura Gmail; no envía ni reintenta en bucle |
| Conexión corregida | Una instancia nueva se recupera después del fallo anterior |
| Client ID pegado como refresh token | Rechazo local antes de contactar a Google |
| Espacios al copiar credenciales | Normalización de los tres valores, sin imponer un prefijo al token |
| Error o identidad incorrecta en monitor | Estado FAILED; no acepta HTTP200 por sí solo |
| Texto arbitrario del proveedor | Se descarta; solo códigos de una lista fija en el recibo |
| Sin credencial del monitor | Falla sin invocar el endpoint privado |

Resultado local: 24/24 pruebas, 0 fallos (`test_google_oauth_reason.mjs` y `test_production_watch.mjs`). Adelantar el reloj es una simulación de vencimiento; no acredita haber observado una hora real.

## Vigilancia permanente y recuperación

El monitor existente ahora invoca `POST /api/partners?action=sdr-verify` con su credencial operativa, en sus horarios actuales de los minutos 17 y 47 de cada hora. Cada petición crea un worker nuevo, renueva contra Google y exige perfil verificado de `ricardo.boltechgroup@gmail.com`. Un fallo agrega `gmail_oauth: FAILED` y termina el trabajo con error; el artefacto `production-health-{run_id}` conserva solo evidencia saneada durante 14 días. Se emplean las notificaciones de GitHub configuradas por el titular; no se afirma haber verificado su entrega. GitHub puede retrasar el cron: dos horarios previstos por hora no son un SLA de detección en 30 minutos.

Si aparece `GMAIL_OAUTH_INVALID_GRANT`, detener el uso afectado, revisar el diagnóstico saneado y reautorizar la misma cuenta con el mismo cliente y permisos aprobados. Guardar **refresh token** en `GMAIL_OAUTH_REFRESH_TOKEN`, Client ID en `GMAIL_OAUTH_CLIENT_ID`, secreto en `GMAIL_OAUTH_CLIENT_SECRET`; redesplegar y ejecutar el workflow existente de conexión antes de declarar recuperado. No sustituir valores a ciegas ni repetir envíos inciertos. La revocación requiere intervención del titular; el código no puede fabricar consentimiento nuevo.

## Alcance y cierre

Certificable: conexión observada, manejo de renovación probado, rechazo de configuración equivocada y detección recurrente instalada. Pendiente al escribir este archivo: comprobantes CI, despliegue y ejecución real del monitor con este cambio; se añadirán al [registro vivo del harness #86](https://github.com/Rick2818/Boltech-Group/issues/86).

Continuidad durante una hora real, varios días y cambios externos permanece sujeta a observación de recibos posteriores. Esto no certifica campañas autónomas, operación completa de todos los agentes, entregas ni ventas.
