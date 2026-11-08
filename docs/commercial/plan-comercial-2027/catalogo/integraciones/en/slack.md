# Slack

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://api.slack.com/
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Canal interno para aprobaciones y avisos del equipo de operaciones.

## Operations tasks it can serve

- pedidos
- facturas
- stock

## Data it would touch

- Mensajes de alerta
- Identificador de canal y usuario que aprueba
- Marca de tiempo de la aprobación

## Authentication

OAuth 2.0 con token de bot (o de usuario) y permisos por alcance.

## Declared limits and risks

- Los límites dependen del método invocado
- El bot solo ve los canales donde se le invita
- Un mensaje con datos de cliente queda en el historial del workspace

## What must be validated before quoting

- Crear una app interna con alcances mínimos
- Definir el canal de aprobación
- Probar el registro de quién aprobó y cuándo

## Limits of this sheet

- No real connection was executed against Slack.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Slack.
- No credentials, no customer data and no spend.
