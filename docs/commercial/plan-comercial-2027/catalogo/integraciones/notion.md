# Notion

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://developers.notion.com/guides/notion-api/quick-start
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Documento compartido del alcance, los criterios de aceptación y los entregables.

## Tareas de operaciones que puede servir

- pedidos
- facturas
- stock

## Qué datos tocaría

- Alcance acordado
- Criterios de aceptación
- Estado de entrega

## Cómo se autentica

Token de integración u OAuth; la integración solo ve las páginas que se comparten con ella.

## Límites y riesgos declarados

- Si no se comparte la página, la integración no la ve (error frecuente)
- La API está versionada: un cambio de versión puede romper el flujo
- No es una base transaccional: no sirve para registrar pedidos a alta frecuencia

## Qué hay que validar antes de cotizar

- Compartir solo la página del proyecto
- Fijar la versión de la API
- Confirmar que el documento no expone datos de otros clientes

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra Notion.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de Notion.
- Sin credenciales, sin datos de clientes y sin gasto.
