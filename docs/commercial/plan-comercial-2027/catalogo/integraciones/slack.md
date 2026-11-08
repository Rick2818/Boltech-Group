# Slack

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://api.slack.com/
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Canal interno para aprobaciones y avisos del equipo de operaciones.

## Tareas de operaciones que puede servir

- pedidos
- facturas
- stock

## Qué datos tocaría

- Mensajes de alerta
- Identificador de canal y usuario que aprueba
- Marca de tiempo de la aprobación

## Cómo se autentica

OAuth 2.0 con token de bot (o de usuario) y permisos por alcance.

## Límites y riesgos declarados

- Los límites dependen del método invocado
- El bot solo ve los canales donde se le invita
- Un mensaje con datos de cliente queda en el historial del workspace

## Qué hay que validar antes de cotizar

- Crear una app interna con alcances mínimos
- Definir el canal de aprobación
- Probar el registro de quién aprobó y cuándo

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Slack.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Slack.
- Sin credenciales, sin datos de clientes y sin gasto.
