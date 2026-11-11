# Leo — diagnóstico y reparación de conexiones

## Nueva comprobación antes de corregir

El intento 2 de la ejecución 43099194584 consultó producción el 11 de noviembre de 2026 a las 21:58 UTC (15:58, El Salvador). El token privado del diagnóstico estaba configurado. Freelancer respondió conectado; Upwork devolvió `UPWORK_AUTHORIZATION_REQUIRED`; Explee devolvió `PROVIDER_HTTP_403` / `ACCESS_DENIED_UNCLASSIFIED`. No hubo búsquedas, postulaciones ni mensajes.

Esto demuestra que la ejecución ya no está detenida en la cola. Los errores corresponden a la autorización de las plataformas, no a un tiempo de espera pendiente de GitHub.

## Corrección de Explee

La comprobación anterior utilizaba POST `/public/api/v1/search/nl-to-filters`. Se sustituye por GET `/public/api/v1/me`, que la documentación oficial recomienda para verificar una clave y declara gratuito. El diagnóstico no hace búsquedas y no consume enriquecimientos ni inicia campañas.

Se valida la respuesta de cuenta y se publican únicamente campos permitidos: conexión, fecha, `accountCheck: GET_ME` y si el proveedor exige saldo positivo antes de buscar. Organización, plan, saldo exacto, alcance de proyectos y credenciales no salen en el informe. Una clave válida con saldo cero sigue siendo una conexión autenticada, aunque no acredita que las búsquedas estén disponibles.

Los errores distinguen, cuando el proveedor lo indica, clave rechazada, restricción de IP, permisos, desafío de acceso y límite de solicitudes. Un 403 sin información suficiente sigue sin clasificarse; no se atribuye a facturación o a una clave inválida sin evidencia. No se prueban rutas alternativas para eludir un rechazo.

## Bloqueo de Upwork

Leo requiere su propia autorización OAuth y un client_id emitido por Upwork. Una sesión del navegador o la conexión de ChatGPT no constituyen autorización de la aplicación alojada en Cloudflare.

La página oficial de Upwork, actualizada el 6 de noviembre, indica que el callback de un agente alojado necesita aprobación y permite pedir su inclusión a soporte, sin garantía de aceptación. El código conserva PKCE, estado y almacenamiento cifrado; no sustituye el callback por el de otra aplicación.

Callback a solicitar: `https://boltech-group.pages.dev/api/upwork/callback`.

### Borrador para soporte — no enviado

Subject: Request to approve the OAuth callback for Boltech Group / Leo

Hello Upwork Support,

We are connecting our own hosted assistant, Leo by Boltech Group, to the official Upwork MCP server at https://mcp.upwork.com/mcp. Our application is hosted at https://boltech-group.pages.dev and its OAuth redirect URI is https://boltech-group.pages.dev/api/upwork/callback.

Please review this callback for approval, or explain the supported onboarding route for our hosted MCP client. We use the provider-issued client identifier, PKCE and OAuth state validation. Our application limits its current use to account verification and user-directed read-only project searches; it does not submit proposals or send messages automatically.

The production account check currently reports UPWORK_AUTHORIZATION_REQUIRED. Our implementation distinguishes dynamic registration denial from authorization failures. We understand callback approval is subject to Upwork review.

Please let us know what non-secret application information you need. We will not provide passwords, OAuth tokens, cookies or API secrets.

Thank you,
Boltech Group

## Verificación posterior

Después de desplegar, repetir la comprobación privada desde el workflow y conservar su resultado real, incluso si Upwork o Explee siguen fallando. Un CI verde o un endpoint de cuenta conectado no acredita autonomía 24/7, búsqueda, propuestas ni ventas.

## Fuentes primarias

- https://api.explee.com/public/api/docs — GET `/public/api/v1/me`, autenticación y requisitos de búsquedas.
- https://www.upwork.com/ai/mcp — OAuth, aprobación de callbacks y permisos.
- https://support.upwork.com/hc/en-us/articles/55446516654611-How-to-use-Upwork-with-AI-agents-through-MCP — información a incluir al contactar soporte.

### Resultado tras desplegar el GET de cuenta

El intento 2 de 43108514341, a las 22:05:43 UTC (16:05, El Salvador), conservó Freelancer conectado y Upwork sin autorización propia de Leo. Explee cambió de 403 a `PROVIDER_RESPONSE_INVALID` durante la validación de la respuesta. No se da por conectado: se añade diagnóstico de tipos de campos fijos, sin valores, para comprobar qué parte del esquema difiere antes de ajustar el adaptador.

### Causa de la validación de Explee identificada

El intento 2 de 43109461043, a las 22:11:41 UTC (16:11, El Salvador), confirmó respuesta HTTP 200 y JSON con organización e identificador de texto y clave como objeto. La única discrepancia con la validación era `balance: null`, sin `balance.remain`. El adaptador debe aceptar el saldo nulo/ausente como metadato no informado, conservando los requisitos de cuenta y clave. Se informa `BALANCE_NOT_REPORTED`; nunca se sustituye por cero, saldo positivo o búsqueda verificada.

### Autenticación de Explee corregida y verificada

El intento 2 de 43110182065, a las 22:17:54 UTC (16:17, El Salvador), confirmó Freelancer y Explee conectados con HTTP 200. Explee informó `accountCheck: GET_ME` y `searchReadiness: BALANCE_NOT_REPORTED`. Upwork conservó `UPWORK_AUTHORIZATION_REQUIRED`. La conexión de Explee ya no requiere cambiar la clave por el saldo no informado.

La opción explícita `--explee-free-search` del diagnóstico añade una sola búsqueda de clínicas en El Salvador, únicamente cuando la cuenta está conectada. El Worker fija página 1 y diez resultados, sin enriquecimiento, listas de exclusión ni paginación; la documentación define esa zona como gratuita y rechaza las solicitudes completamente gratuitas que superan su cupo. Se conserva solo número de resultados, recibo registrado y cargo cero si el proveedor lo declara, sin empresas ni datos de contactos en logs. No se activa operación continua. Un rechazo o límite no se reintenta automáticamente.
