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
| Configuración Redis del proyecto | Panel Vercel verificado 29/09/2026 ~18:54 El Salvador: búsqueda UPSTASH en All Environments sin resultados; ninguna variable compartida enlazada; Storage sin bases conectadas |
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

## Revisión directa Redis en Vercel

Sesión autenticada en el proyecto `boltech-group`. Environment Variables / Project con `All Environments` y búsqueda `UPSTASH`: `No Results Found`. Environment Variables / Shared sin filtro: `No shared variables linked`. Storage del proyecto sin filtros: ninguna base conectada. Connect Database no mostró una base existente disponible. No se crearon recursos, no se conectaron bases y no se revelaron ni cambiaron credenciales.

Conclusión: faltan `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` en los entornos consultados. No se puede ejecutar ni certificar el almacenamiento durable A2A de esta revisión. Antes de promocionar el PR, configurar Redis con un plan y acceso aprobados, asignar las variables a Production y Preview, desplegar de nuevo y probar conexión y replay. La creación o instalación de una integración requiere comprobar sus condiciones y coste antes de confirmar; esta auditoría no autoriza por sí misma compras ni nuevas credenciales.

## Redis aprovisionado — 2026-09-30, sesión de la mañana

Tras aprobación explícita del titular se instaló Upstash Redis mediante Vercel Marketplace y se creó `boltech-a2a-ledger`: plan Free, 500000 comandos mensuales, región `iad1`, Eviction desactivado. Estado del proveedor: Available. La consola REPL devolvió `PONG` a `PING`.

La integración quedó conectada a Production y Preview como secretos (`KV_REST_API_*`). Se añadieron además los nombres exactos requeridos por el código, `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, en ambos entornos; el panel confirmó guardado. No se incluyen valores. Los despliegues existentes necesitan reconstruirse para recibir estos cambios.

La suite local vigente volvió a pasar: 49/49. El commit `633ab2ee5620820d7bfe3d988fe36a0a605b788d` tenía estado Vercel success y GitHub Actions Governance Validation success (run 36652473173).

Bloqueos para verificación integrada: `AIRTABLE_TOKEN` sigue limitado a Production; Preview no tiene acceso Airtable configurado. No está disponible la credencial original del partner interno `Boltech A2A QA Partner`. No se amplió acceso al CRM ni se rotó esa credencial. Se requiere resolver ambos accesos antes de certificar SendMessage → Referral/Activity → GetTask → replay y antes de integrar el PR #16. PONG confirma conectividad del proveedor, no el flujo de la aplicación.

El plan gratuito permite una sola base. Production y Preview comparten Redis: las verificaciones deben usar messageIds únicos por entorno; compartir credenciales no constituye aislamiento de acceso entre entornos. No se deben borrar reservas ni reutilizar IDs para resolver errores parciales.

## Preparación de prueba — 2026-09-30

Se completó la preparación autorizada para una verificación técnica controlada de esta revisión. El flujo integrado permanece pendiente. Este cambio documental genera un nuevo Preview que incorpora la configuración actual. Los secretos y detalles internos de acceso se excluyen de esta actualización pública.

## Ejecución final — 2026-09-30

- Upstash Redis se creó en la región `iad1` con plan Free (500000 comandos/mes), eviction desactivado. El REPL confirmó `PING → PONG`.
- Los secretos de runtime requeridos están configurados en Production y Preview. Airtable también quedó accesible en Production y Preview; ningún valor secreto se añadió a Git.
- PR #16 se integró en `main` mediante merge commit `64aae4a4f6827deedf94fb45f0d8e666228df527`. El despliegue de producción de ese commit está READY.
- Regresiones locales: 49/49 aprobadas. CI Governance Validation pasó para la revisión probada.
- Preview y Production superaron: falta de Bearer → 401; autenticación y `SendMessage` → 200; tarea en estado completado; `GetTask` → 200 con el mismo resultado; replay idéntico → 200 sin duplicar; mismo `messageId` con contenido modificado → 409.
- Airtable confirmó exactamente un Referral y una Partner Activity asociados a cada una de las dos comprobaciones técnicas. Se registraron como QA interno, sin datos de clientes y sin contabilizarlos como tracción o ventas.
- El enlace temporal del Preview fue revocado después de probar. El partner interno temporal de QA quedó `PAUSED`, A2A deshabilitado y hash de credencial eliminado.

La verificación demuestra este flujo en los dos entornos con una identidad temporal interna. No certifica integración comercial externa ni todos los métodos del protocolo A2A. Streaming, notificaciones push y negociación multi-turn quedan fuera del alcance.
