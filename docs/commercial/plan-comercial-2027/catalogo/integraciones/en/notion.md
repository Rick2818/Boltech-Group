# Notion

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://developers.notion.com/guides/notion-api/quick-start
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

Documento compartido del alcance, los criterios de aceptación y los entregables.

## Operations tasks it can serve

- pedidos
- facturas
- stock

## Data it would touch

- Alcance acordado
- Criterios de aceptación
- Estado de entrega

## Authentication

Token de integración u OAuth; la integración solo ve las páginas que se comparten con ella.

## Declared limits and risks

- Si no se comparte la página, la integración no la ve (error frecuente)
- La API está versionada: un cambio de versión puede romper el flujo
- No es una base transaccional: no sirve para registrar pedidos a alta frecuencia

## What must be validated before quoting

- Compartir solo la página del proyecto
- Fijar la versión de la API
- Confirmar que el documento no expone datos de otros clientes

## Limits of this sheet

- No real connection was executed against Notion.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by Notion.
- No credentials, no customer data and no spend.
