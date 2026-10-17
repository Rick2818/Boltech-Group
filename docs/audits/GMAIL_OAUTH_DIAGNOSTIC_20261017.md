# Gmail OAuth: diagnóstico seguro del rechazo recurrente

Fecha: 17 octubre 2026, El Salvador. Responsable: Codex por instrucción de Ricardo de continuar el diagnóstico y corregir lo comprobable. Presupuesto adicional: USD 0.

## Evidencia y alcance

- Google Cloud, cuenta corporativa, proyecto `boltech-group-gmail-oauth`: **En producción**, usuario externo, aplicación aún sin verificar. Esto actualiza el estado Prueba del informe histórico del 16 de octubre. No se modificaron permisos ni credenciales.
- `Cliente web 1` existe y tiene dos secretos habilitados. Google ya no permite leer los secretos existentes. No se inhabilitó ninguno.
- Vercel Production: refresh token actualizado `2026-10-16T20:04:56.340Z`; Client ID y secret actualizados a las 03:08 y 03:09 UTC del mismo día. Las fechas no prueban coincidencia de valores ni emisión del token.
- Reejecución del workflow existente: [38942092669, intento 5](https://github.com/Rick2818/Boltech-Group/actions/runs/38942092669/attempts/5), job `117414126529`. Recibo `2026-10-17T14:00:40.515Z`: configuración presente, renovación real en producción **FAILED / GMAIL_OAUTH_INVALID_GRANT**. No envió correos. El checkout del workflow es histórico; la API consultada es producción actual.
- El Playground abierto estaba sin credenciales propias seleccionadas y sin solicitud emitida. No demuestra cómo se generó el token almacenado en producción.

## Cambio mínimo

El conector conserva los códigos de error existentes y añade un registro seguro `[GMAIL_OAUTH_DIAGNOSTIC]` al fallar el intercambio. Solo registra etapa, código permitido, categoría fija, estado HTTP y huella SHA-256 truncada del Client ID público. Nunca registra tokens, secretos, cuerpo de respuesta, descripción libre ni contenido de correos.

La descripción de Google se clasifica en memoria. `TOKEN_EXPIRED_OR_REVOKED` conserva esa ambigüedad: no atribuye la revocación a una acción específica. `invalid_rapt` se distingue como necesidad de reautenticación. Si Google no proporciona evidencia suficiente, se conserva `CAUSE_UNDETERMINED`.

La huella permite comparar el cliente usado por producción con el cliente propio de Google Cloud sin exponer credenciales. No acredita que el token pertenezca a ese cliente.

## Pruebas y aceptación

Ocho pruebas locales aprobadas: códigos originales, identidad correcta, categorías del proveedor, descarte de texto libre, ausencia de secretos en logs y una sola solicitud sin acceso a Gmail tras rechazo. Se añade esta batería al workflow de conexión existente; no se crea automatización ni emisor adicional.

La verificación del cambio en producción y su resultado se registrarán tras observar el despliegue. Un diagnóstico mejorado no restaura por sí solo un permiso rechazado por Google. No certificar Gmail operativo sin renovación y perfil correctos; no certificar continuidad por una única prueba.

Rollback: revertir el commit diagnóstico. No cambia pagos, Wompi, modelos, ofertas, autorizaciones comerciales ni transporte de correo.

## Siguiente decisión

Si el proveedor confirma token caducado o revocado, se requiere autorización vigente de la cuenta con el cliente propio correcto. Si la cuenta o las credenciales necesarias no están accesibles, dejar ese bloqueo explícito y evaluar SMTP/IMAP con contraseña de aplicación elegible, sin contratar servicios ni cambiar el transporte automáticamente.
