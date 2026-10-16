# Gmail OAuth: diagnóstico y textos propuestos para producción

Fecha: 16 octubre 2026, hora de El Salvador.
Estado: BORRADOR PARA REVISIÓN. No es una política publicada, una certificación ni autorización adicional.

## Resultado observado

- Google Cloud, proyecto boltech-group-gmail-oauth: External / Prueba.
- Publicar app deshabilitado; Google pide completar la configuración de marca.
- Se guardaron la página https://boltech-group.vercel.app y el dominio boltech-group.vercel.app. No se cambiaron credenciales, scopes ni pagos.
- No hay enlaces de privacidad ni condiciones configurados. El repositorio revisado no contiene páginas dedicadas para esos enlaces.
- Cliente web 1 existe, creado el 14 de octubre; último uso mostrado: 15 de octubre (Google advierte retraso de un día o más). Dos secretos habilitados; no se eliminaron.
- Google Account muestra la autorización Boltech Group Gmail, otorgada el 14 de octubre. Esto no demuestra que cada refresh token siga vigente.
- Último cambio de contraseña mostrado: 25 de septiembre.
- Vercel Production: GMAIL_OAUTH_REFRESH_TOKEN actualizado 2026-10-16T03:01:46.578Z; CLIENT_ID 03:08:12.235Z; CLIENT_SECRET 03:09:41.343Z. No hay cambios posteriores en esos registros.
- Renovación y perfil confirmados por el recibo histórico a las 03:13 UTC; otro workflow exitoso a las 03:46 UTC. Fallos actuales: GMAIL_OAUTH_INVALID_GRANT; harness #86.
- Producción READY, commit 9828476b850869ae723118e9e0fdf11bca869044. READY no certifica Gmail.

## Conclusión acotada

El modo Prueba crea riesgo documentado de caducidad de siete días con permisos Gmail. No explica por sí solo el rechazo de un token recién emitido en menos de un día. La fecha de edición de una variable no prueba la fecha de emisión del token. La causa exacta del invalid_grant sigue sin determinarse.

lib/sdr_gmail.js ya solicita access tokens automáticamente mediante grant_type=refresh_token y cachea su vigencia. Google rechaza el intercambio antes de consultar Gmail. El código conserva el error OAuth normalizado; no conserva error_description ni error_subtype. No inventar una causa de revocación.

El cliente propio y la autorización de Boltech existen; no hay evidencia suficiente para atribuir este caso a los tokens por defecto de Playground. No publicar esa hipótesis como hallazgo.

## Textos propuestos para páginas dedicadas

Estos textos requieren revisión de Ricardo antes de publicarse. Se limitan a la integración privada Gmail; no sustituyen las condiciones comerciales de agentes ni alteran Wompi.

### Privacidad — Integración Gmail de Boltech Group

La integración es operada por Boltech Group para gestionar su cuenta corporativa autorizada, ricardo.boltechgroup@gmail.com. No ofrece conexión de buzones a clientes externos.

Mediante la autorización de Google, la integración consulta el perfil de la cuenta, busca y lee mensajes e hilos y envía mensajes para gestionar comunicaciones comerciales, registrar su estado y conciliar respuestas. Los permisos concedidos pueden ser más amplios que las operaciones actualmente implementadas.

Los mensajes, identificadores, datos de contacto y estados necesarios para esa gestión se procesan en la infraestructura y los servicios configurados de Boltech Group, entre ellos Google/Gmail, Vercel, Redis y Airtable. El alcance concreto depende de la ruta ejecutada. Las credenciales OAuth se conservan en los almacenes de secretos configurados; no deben publicarse en repositorios, documentación ni registros.

El operador puede retirar la autorización desde su Cuenta de Google. Esa retirada detiene el acceso futuro; no elimina por sí sola mensajes o registros ya conservados. Para consultar el tratamiento de información o solicitar revisión y eliminación de registros, escribir a ricardo.boltechgroup@gmail.com. Los registros se revisarán según la necesidad operativa y las obligaciones aplicables.

El uso y la transferencia de información recibida de las API de Google deben cumplir la Google API Services User Data Policy, incluidos sus requisitos de Limited Use.

### Condiciones — Integración Gmail de Boltech Group

Esta integración es una herramienta privada para operar la cuenta corporativa autorizada de Boltech Group. Su autorización corresponde al titular de esa cuenta.

Permite consultar y gestionar comunicaciones mediante las API de Google. Su disponibilidad depende de Google, de las credenciales vigentes y de la infraestructura configurada. Una autenticación correcta no garantiza entrega, respuesta comercial ni ventas.

El titular puede revocar el acceso desde su Cuenta de Google y contactar a ricardo.boltechgroup@gmail.com para solicitar asistencia. Estas condiciones describen únicamente la integración Gmail y no cambian cotizaciones, contratos, cobros ni condiciones de los productos comerciales de Boltech Group.

## Secuencia de aceptación pendiente

1. Ricardo revisa los textos y las prácticas descritas. Resolver datos de conservación no documentados antes de añadir plazos o garantías.
2. Preparar páginas dedicadas y enlace visible en la página principal; verificar contenido y accesibilidad. Publicarlas solo tras aprobación de los textos.
3. Registrar los enlaces reales en Google Cloud y comprobar si habilita publicación; completar los requisitos adicionales que Google indique. No declarar que los enlaces resolverán por sí solos cualquier bloqueo.
4. Revisar scopes mínimos: el código actual consulta perfil, mensajes e hilos y envía; no ampliar permisos para resolver invalid_grant.
5. Emitir una nueva autorización con el cliente propio verificado, acceso offline y la cuenta corporativa. No reutilizar código de autorización; no confundir access token con refresh token. La intervención del titular puede ser necesaria.
6. Actualizar el almacén de secretos de producción, redesplegar y verificar renovación/perfil mediante el workflow existente. Registrar el recibo y verificar de nuevo tras expirar el access token; no crear un cron duplicado ni reintentar envíos inciertos.
7. Certificar únicamente las operaciones realmente observadas. Un token nuevo no garantiza vigencia perpetua; la revocación por Google o por el titular requiere reautorizar.

## Fuentes y evidencia

- https://developers.google.com/identity/protocols/oauth2#expiration
- https://developers.google.com/oauthplayground/ (el Playground predeterminado advierte revocación a las 24 horas; no está demostrado que aplique al token actual).
- https://support.google.com/cloud/answer/15549049?hl=en
- docs/audits/GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md
- lib/sdr_gmail.js
- https://github.com/Rick2818/Boltech-Group/issues/86

No se enviaron correos ni se hicieron cobros durante esta revisión.
