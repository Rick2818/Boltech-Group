# Telegram

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://core.telegram.org/bots/api
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Aviso interno inmediato de alertas de stock o de pedidos dudosos.

## Tareas de operaciones que puede servir

- pedidos
- stock

## Qué datos tocaría

- Texto de la alerta
- Identificador del chat interno
- Ningún dato de cliente en el mensaje por defecto

## Cómo se autentica

Token de bot emitido por BotFather; el bot solo actúa en los chats donde se le añade.

## Límites y riesgos declarados

- El token del bot es una credencial secreta y no debe registrarse en logs
- Telegram no garantiza entrega ni orden de los mensajes
- Escribir datos personales en un chat externo cambia la base legal

## Qué hay que validar antes de cotizar

- Crear un bot de prueba y un chat interno cerrado
- Definir el texto mínimo sin datos personales
- Probar el comportamiento con el bot silenciado

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Telegram.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Telegram.
- Sin credenciales, sin datos de clientes y sin gasto.
