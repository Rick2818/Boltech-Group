# Telegram

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://core.telegram.org/bots/api
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Aviso interno inmediato de alertas de stock o de pedidos dudosos.

## Operations tasks it can serve

- pedidos
- stock

## Data it would touch

- Texto de la alerta
- Identificador del chat interno
- Ningún dato de cliente en el mensaje por defecto

## Authentication

Token de bot emitido por BotFather; el bot solo actúa en los chats donde se le añade.

## Declared limits and risks

- El token del bot es una credencial secreta y no debe registrarse en logs
- Telegram no garantiza entrega ni orden de los mensajes
- Escribir datos personales en un chat externo cambia la base legal

## What must be validated before quoting

- Crear un bot de prueba y un chat interno cerrado
- Definir el texto mínimo sin datos personales
- Probar el comportamiento con el bot silenciado

## Limits of this sheet

- No real connection was executed against Telegram.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Telegram.
- No credentials, no customer data and no spend.
