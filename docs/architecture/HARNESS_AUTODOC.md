# Harness: actualización automática y Vercel

Registro vivo: **[Harness — verificaciones automáticas, issue #86](https://github.com/Rick2818/Boltech-Group/issues/86)**. Esta página describe el mecanismo; la tabla operativa se actualiza en ese enlace, no en los archivos Markdown versionados.

## Activación

El workflow `.github/workflows/harness_autodoc.yml` se activa en cada push de main, al finalizar los workflows de main vigilados, ante avisos de despliegue y mediante workflow_dispatch. No necesita la computadora de Ricardo, no añade cron ni llama a modelos. Reutiliza el token operacional existente de GitHub Secrets para el diagnóstico privado de Vercel. GITHUB_TOKEN tiene solo lectura de código/Actions y escritura del registro de issues.

En pushes de main y avisos de despliegue productivo exitoso, la comprobación espera hasta observar en `GET /api/partners?action=rsi-agents` el SHA esperado. Después hace `POST /api/partners?action=sdr-verify` para renovar OAuth y leer el perfil del remitente. Solo `sameCommit=true`, `gmailVerified=true` y la cuenta Boltech producen `VERIFIED_EXACT_REVISION_AND_GMAIL`. READY, una página accesible o un workflow verde no sustituyen esa prueba.

Un diagnóstico fallido también se publica, conservando el código de error y el commit esperado. Avisos Preview se ignoran; un aviso inactive de un despliegue anterior no reemplaza una verificación válida. El diagnóstico nunca envía correos, activa ejecutores, cambia variables, crea enlaces de pago ni cobra.

## Registro, evidencia y recuperación

El actualizador reconstruye los últimos resultados de los 15 workflows vigilados, enlaza commit, ejecución, intento, fecha y artifacts. Guarda un comentario por recibo procesado con marcador estable y verifica la escritura leyendo la issue. Los reintentos no duplican comentarios. No descarga ni ejecuta artifacts, logs o código del productor. El job con permisos de escritura usa código de main.

La concurrencia serializa actualizaciones. GitHub puede agrupar/cancelar avisos pendientes; por eso cada ejecución reconstruye los últimos resultados, además de procesar su aviso. La tabla es un estado actual recuperable, no un registro exhaustivo de todos los runs históricos. Los comentarios conservan recibos procesados; los artifacts generados `harness-live-status.json`, `HARNESS_LIVE_STATUS.md` y el probe de Vercel duran 30 días. GitHub Actions conserva sus logs según la política del repositorio.

No se publican credenciales, textos de clientes ni contenido de artifacts. Se preservan `failure`, `cancelled`, `timed_out`, etc. sin reinterpretarlos como éxito. `success` representa el resultado del workflow; las afirmaciones funcionales requieren sus recibos. Las pruebas locales o dirigidas por un operador deben registrarse explícitamente como las auditorías anteriores: no se descubren desde la conversación.

## Criterio de certificación

1. Pruebas de `tests/test_harness_autodoc.mjs` aprobadas.
2. Publicación real por GitHub Actions y readback coincidente en issue #86.
3. Probe real de Vercel con el commit de despliegue esperado y Gmail verificado.
4. Segundo resultado de workflow incorporado automáticamente para comprobar la actualización por evento.

La certificación del mecanismo se documenta por separado después de observar esos recibos. No acredita coordinación comercial autónoma de todos los agentes, entrega de un cliente, campaña o venta.
