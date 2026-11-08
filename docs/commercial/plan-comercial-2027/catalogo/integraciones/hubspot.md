# HubSpot

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://developers.hubspot.com/docs/api-reference/latest/overview
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

CRM para registrar la solicitud y su etapa; no ejecuta tareas de operaciones.

## Tareas de operaciones que puede servir

- Ninguna de las tres tareas operativas: se usa para registrar la solicitud en el CRM.

## Qué datos tocaría

- Empresa, contacto, correo y tema de la solicitud
- Etapa del recorrido y notas de cualificación

## Cómo se autentica

OAuth 2.0 para apps distribuidas o token de app privada para uso interno.

## Límites y riesgos declarados

- El CRM trata datos personales: requiere base legal y política de retención
- Los límites se aplican por app y por cuenta
- Los campos personalizados deben crearse antes de la primera escritura

## Qué hay que validar antes de cotizar

- Confirmar plan y límites de la cuenta
- Definir campos obligatorios y deduplicación
- Probar la creación de un contacto de prueba y su borrado

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra HubSpot.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de HubSpot.
- Sin credenciales, sin datos de clientes y sin gasto.
