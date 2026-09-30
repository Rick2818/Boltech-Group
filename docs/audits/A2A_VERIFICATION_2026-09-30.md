# A2A — Correcciones y verificación

Fecha UTC: 2026-09-30; fecha local El Salvador: 2026-09-29.
Base revisada: `94b57bd402c20f5969a947d1b7a7c4198054f01a`.

## Historia y alcance

Un agente de un partner aprobado descubre el Agent Card, envía una Need Card autenticada, Boltech registra un referral y una actividad en Airtable y devuelve una tarea consultable por ese mismo partner. Esto registra una oportunidad; no despacha campañas, introduce clientes automáticamente ni confirma ingresos.

## Brechas corregidas

- `Boolean("false")` podía autorizar datos de cliente: ahora solo se acepta consentimiento boolean JSON y se rechazan cadenas.
- Un retry podía crear otro referral y otra actividad: reserva atómica persistente en Upstash Redis antes de escribir. Mensajes completados se reproducen sin escritura; mensajes incompletos quedan bloqueados para reconciliación humana.
- `SendMessage` devolvía una Task directa: ahora devuelve el envelope v1 `result.task`; se conserva `message/send` legado.
- Se añade `GetTask` con aislamiento por partner autenticado.
- Se validan mensaje, partes, presupuesto, resumen, tamaño y método. Las fallas externas devuelven un error seguro sin secretos ni contenido privado del proveedor.
- Solo se reporta completado después de recibir IDs de Referral y Partner Activity y persistir el resultado.
- El matching exige al menos una capacidad compatible.
- La búsqueda de credencial se filtra en Airtable, sin depender de los primeros 500 partners; una credencial ambigua no autoriza acceso.

## Evidencia

| Límite | Estado observado |
|---|---|
| Agent Card público | HTTP 200 mediante Vercel, 2026-09-30 00:37 UTC |
| Ruta A2A desplegada | GET HTTP 405 `POST required`, 00:38 UTC; baseline anterior a estos cambios |
| Contratos locales A2A | 15 pruebas aprobadas con fixtures aislados, sin tráfico ni escrituras reales |
| Partner Network | 6 pruebas aprobadas |
| Gobernanza operacional | 5 pruebas aprobadas |
| Pagos / MCP / lógica comercial | 11 / 3 / 9 pruebas aprobadas; total con A2A y partners: 49 |
| Partner comercial externo | No habilitado: 7 PROSPECT en Airtable; único ACTIVE/A2A Enabled es `Boltech A2A QA Partner` |
| Configuración Redis de producción | No comprobada mediante los conectores disponibles |
| Intercambio autenticado de esta versión desplegada | Pendiente; las pruebas locales no son evidencia de ejecución real |

La suite ampliada requirió permitir un servidor local para el handshake MCP; fuera de esa restricción pasó completa.

Los contratos cubren consentimiento, atribución, duplicados secuenciales y concurrentes, cambios de payload, orden de claves JSON, falta y caída de Redis, falla parcial de actividad, falla de persistencia final, consulta aislada por partner y compatibilidad del método legado.

## Requisitos antes de activar esta versión

1. Verificar los secretos de runtime `AIRTABLE_TOKEN`/`AIRTABLE_PAT`, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`; valores nunca en Git ni en reportes. Redis debe conservar las reservas, sin eviction ni limpieza automática.
2. Revisar CI y desplegar la revisión exacta. Este cambio falla cerrado (503) si falta Redis; no reemplaza almacenamiento durable con RAM.
3. Usar una credencial de QA ya aprobada mediante un canal seguro para ejecutar una comprobación controlada identificada como QA, nunca como lead/venta real. Confirmar Referral y Partner Activity por sus IDs genuinos.
4. Repetir el mismo `messageId` y payload y comprobar que no hay nuevas escrituras; consultar `GetTask`.
5. Para operación comercial, obtener aprobación real del primer partner y provisionar su credencial independiente antes de habilitarlo. No convertir candidatos PROSPECT en ACTIVE por conveniencia de una prueba.

La reserva permanente favorece no duplicación frente a recuperación automática. Una ejecución que escribió parcialmente necesita revisión; el operador comprueba Airtable por `A2A Task ID` y reconcilia sin borrar la reserva ni cambiar el ID para repetir. Una pérdida del ledger Redis elimina la garantía de replay. Los campos libres de resumen/notas deben excluir PII no autorizada: el enmascaramiento de campos estructurados no detecta toda identidad embebida en texto.

Referencia primaria del envelope A2A v1: https://a2a-protocol.org/latest/specification/#943-core-methods

No se certifica compatibilidad completa con todos los métodos A2A ni funcionamiento comercial al 100%. Esta implementación cubre registro síncrono de Need Cards y consulta de las tareas que creó; streaming, notificaciones push y negociación multi-turn no están implementados.
