# Gmail

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://developers.google.com/gmail/api
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Lectura de pedidos y facturas que llegan por correo, sin copiarlos a mano.

## Tareas de operaciones que puede servir

- pedidos
- facturas

## Qué datos tocaría

- Remitente, asunto, cuerpo y adjuntos de los mensajes de pedido
- Facturas adjuntas en PDF

## Cómo se autentica

OAuth 2.0 con alcances (scopes) concedidos por el usuario; el acceso se revoca desde la cuenta.

## Límites y riesgos declarados

- Leer un buzón implica tratar datos personales de terceros
- Los alcances amplios deben justificarse o rechazarse en la revisión de la app
- Un adjunto escaneado sin texto puede no ser legible sin OCR

## Qué hay que validar antes de cotizar

- Definir el buzón exacto y los alcances mínimos
- Confirmar si la app requiere verificación del proveedor
- Probar con mensajes reales anonimizados

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Gmail.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Gmail.
- Sin credenciales, sin datos de clientes y sin gasto.
