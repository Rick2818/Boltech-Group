# n8n

Estado: `PROPOSED_REQUIRES_TECHNICAL_VALIDATION` · Precio: cotización según alcance
Fuente oficial: https://docs.n8n.io/
Comprobación de fuente: 2026-11-05, respuesta HTTP 200.
Esta ficha confirma que la documentación existe y responde. **No confirma que exista una
conexión probada, ni que la integración esté disponible.**

## Para qué sirve aquí

Orquestador de los tres flujos: dispara, transforma y registra sin servidor propio.

## Tareas de operaciones que puede servir

- pedidos
- facturas
- stock

## Qué datos tocaría

- Los datos que pasan por cada nodo
- Credenciales guardadas por nodo
- Historial de ejecuciones

## Cómo se autentica

Credenciales por nodo, almacenadas y cifradas por la instancia; webhooks con su propia URL.

## Límites y riesgos declarados

- Autoalojado exige mantenimiento, respaldo y actualizaciones de seguridad
- El historial de ejecuciones puede contener datos personales
- Una instancia expuesta sin autenticación permite ejecutar flujos ajenos

## Qué hay que validar antes de cotizar

- Elegir entre nube y autoalojado
- Definir retención del historial de ejecuciones
- Probar reintentos y ejecuciones duplicadas

## Límites de esta ficha

- No se ha ejecutado ninguna conexión real contra n8n.
- No se ha verificado ningún límite numérico: se consulta en la validación técnica.
- No implica afiliación, patrocinio ni certificación de n8n.
- Sin credenciales, sin datos de clientes y sin gasto.
