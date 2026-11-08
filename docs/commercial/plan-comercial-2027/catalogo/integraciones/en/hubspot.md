# HubSpot

Status: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Price: quoted after scope review
Official source: https://developers.hubspot.com/docs/api-reference/latest/overview
Source check: 2026-11-05, HTTP 200.
This sheet confirms the documentation exists and responds. **It does not confirm a tested
connection, nor that the integration is available.**

## What it is for here

CRM para registrar la solicitud y su etapa; no ejecuta tareas de operaciones.

## Operations tasks it can serve

- None of the three operations tasks: it is used to record the request in the CRM.

## Data it would touch

- Empresa, contacto, correo y tema de la solicitud
- Etapa del recorrido y notas de cualificación

## Authentication

OAuth 2.0 para apps distribuidas o token de app privada para uso interno.

## Declared limits and risks

- El CRM trata datos personales: requiere base legal y política de retención
- Los límites se aplican por app y por cuenta
- Los campos personalizados deben crearse antes de la primera escritura

## What must be validated before quoting

- Confirmar plan y límites de la cuenta
- Definir campos obligatorios y deduplicación
- Probar la creación de un contacto de prueba y su borrado

## Limits of this sheet

- No real connection was executed against HubSpot.
- No numeric limit was verified: it is checked during technical validation.
- It does not imply affiliation, sponsorship or certification by HubSpot.
- No credentials, no customer data and no spend.
