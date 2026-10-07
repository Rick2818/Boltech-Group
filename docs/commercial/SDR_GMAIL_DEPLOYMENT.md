# SDR: conexión y verificación de envío

Las rutas protegidas viven en /api/partners; no agregan una función Vercel. PARTNER_API_TOKEN es autenticación administrativa, nunca una credencial partner. No hay campaña ni disparador de envíos habilitado por esta entrega.

- GET action=sdr-status: configuración, sin valores secretos.
- POST action=sdr-verify: verifica cuenta Google, sin enviar.
- GET action=sdr-metrics: estados de trabajos durables. No incorpora envíos históricos mediante conectores y no fabrica respuestas.
- POST action=sdr-send con candidate: solo READY_FOR_CONTACT investigado y aceptado, revisión Gmail/Apollo/CRM/exclusiones menor a una hora. Remitente exclusivo ricardo.boltechgroup@gmail.com. Historial Gmail y contacto CRM se vuelven a consultar; una cuenta recibe un inicial. Ventana lunes-viernes09-13SV,20 intentos/hora,100 mensajes agregados del buzón/24h como techo conservador; cuotas del proveedor pueden reducirlo.
- POST action=sdr-reconcile con id: recuperar recibo por Message-ID RFC exacto, sin reenviar UNKNOWN. Una ausencia de resultado no habilita automáticamente otro intento.

Redis guarda claim permanente por cuenta, SEND_PENDING antes de Gmail y recibo SENT con messageId/threadId. Si la red falla durante envío queda UNKNOWN. Si CRM falla después conserva SENT/SYNC_PENDING y permite reconciliar. El transporte no cambia de identidad ni canal al fallar.

## Paso humano pendiente: OAuth

Production necesita GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET y GMAIL_OAUTH_REFRESH_TOKEN. Se guardan como secretos directamente en Vercel, nunca en chat ni repositorio. Gmail API debe estar habilitada en un proyecto Google autorizado. Se necesita gmail.send para envío y gmail.readonly para perfil/historial/recuperación; gmail.send por sí solo no permite esa conciliación. La ampliación de permisos requiere consentimiento humano. El refresh token debe autorizar exclusivamente la cuenta comercial y acceso offline. Verificar política y estado de la aplicación para no depender de un token de pruebas que expire.

Tras guardar los secretos, desplegar nuevamente y ejecutar la verificación de conexión. Luego prueba autorizada aislada con recibo y persistencia; antes de operación programada verificar exclusiones, cuotas y respuestas actuales. El workflow sdr_connection_verification solo lee configuración/métricas y verifica cuenta: no despacha leads.

Fuentes oficiales: https://developers.google.com/workspace/gmail/api/guides/sending ; https://developers.google.com/identity/protocols/oauth2/web-server .

## Límites y estado

La desactivación del SDR ChatGPT no puede administrarse con estas rutas. Los mensajes de ese chat reportan rechazo de SEND_PENDING, pero no incluyen logs de la plataforma que prueben la causa exacta de desactivación. No reactivar a ciegas ni afirmar que se eliminó aquel bloqueo. Este worker de aplicación sigue autorización comercial ya otorgada y controles propios, sin usar las credenciales del conector ChatGPT.

READY_FOR_CONTACT necesita evidencia real y aceptación comercial. El caller administrativo aporta la conciliación vigente Apollo/exclusiones; este módulo no consulta Apollo por sí mismo. No se considera autónomo completo sin un operador que prepare y actualice esa revisión. Conectar investigación y programación exige una verificación adicional después de OAuth, conservando un único emisor.
