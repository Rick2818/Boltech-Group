# Harness — Certificación operativa de entregas de clientes (15 de octubre de 2026)

## Objetivo y alcance
Esta extensión de la Regla de Oro 1 obliga a probar el recorrido de prestación de servicios **antes de ofrecer garantías al cliente**. No se considera CERTIFICADO un documento, una simulación exitosa o un GitHub Action verde si faltan pruebas del pedido, del agente, de los ejecutores o de la aceptación real. Prioridad: trabajos comercialmente vendidos/contratados y entregas satisfactorias, sin costes no autorizados.

## Referencias auditables
- PR #75 fusionado a `main`, merge SHA `964ca13cd79e8a401528c2bc371f3b2648d74b7d`: https://github.com/Rick2818/Boltech-Group/pull/75
- Ejecución GitHub Actions `38762841521`: https://github.com/Rick2818/Boltech-Group/actions/runs/38762841521. Pruebas **4/4 PASS**, evidencia JSON subida; Vercel respondió correctamente. Estado obtenido: **INFRA_PASS**, exclusivamente alcance de infraestructura.
- `.github/workflows/client_delivery_certification.yml`: workflow comprobable GitHub + Vercel; `lib/client_delivery_certification.js` asegura que una prueba sintética no certifique un pedido de un cliente.
- A1 comercial NO CERTIFICADO en ciclo integral: evidencia `GMAIL_OAUTH_AUTH_FAILED`, 225 examinados, 0 aprobados, 0 envíos, sin cron programado confirmado el 15 de octubre; ver `docs/audits/A1_COMMERCIAL_READINESS_2026-10-15.md` en la rama ASMAS.
- PR #74 https://github.com/Rick2818/Boltech-Group/pull/74 estaba sin fusionar al redactar este registro. No atribuir esta corrección a producción.

## Responsables propuestos para entrega de cliente
- **A4**: director de operación, dueño de fechas y supervisión.
- **A2**: interlocutor del cliente, alcance, cambios y acta de aceptación.
- **E1**: implementación, código e integraciones.
- **E2**: QA funcional, seguridad y regresión.
- **E3**: auditor independiente de evidencias y certificador de cumplimiento.
- **E4 / RSI**: diagnóstico de bloqueos, reintentos seguros limitados, escalamiento.
Estos nombres representan **roles en diseño**, no ejecutores productivos acreditados. No afirmar que existen, están contratados o que ya funcionan.

## Contrato de ejecución (para futura implementación real)
1. Registrar pedido con `orderId`, alcance, entregables, criterios medibles de aceptación, responsable y plazo. Nunca inferir contratación a partir de anuncio de Upwork.
2. E1 produce artefactos y recibo de implementación versionado.
3. E2 produce evidencia de pruebas; fallos bloquean avance y activan diagnóstico E4. Reintentos acotados y con idempotencia; nunca reintentar efectos externos inciertos.
4. E3 inspecciona evidencias y la configuración real en Vercel; emite PASS solo si cumple los criterios exactos y la ejecución del cliente corresponde al pedido.
5. A2 consigue aceptación explícita documentada; A4 cierra ciclo con informe y registro.
6. GitHub Actions ejecuta QA, conserva recibos como artefactos y falla ante requisitos incumplidos. Vercel aloja servicios y observabilidad; su respuesta HTTP 200 **no** certifica un pedido.
7. Watchdog/cola persistente y ejecutor redundante son **futuros controles pendientes de implementar y probar**. Su mera mención no acredita alta disponibilidad.

## Prueba sintética acotada
El módulo `lib/client_delivery_rehearsal.js` en la rama de trabajo ejecuta un guion determinista **sin integración de negocio ni pedidos reales**: E1 simula construcción, E2 prueba escenario, E4 recupera un fallo simulado cuando se solicita, E3 evalúa evidencias sintéticas. Debe producir `kind=SYNTHETIC_ONLY`, `customerAccepted=false`, `customerDelivered=false` y hash SHA-256 del recibo. Un PASS en esta prueba **no prueba** programación real de agentes, cola persistente, reconciliación ni satisfacción de Katia Designs.

## Estimación comercial (no contrato)
Para un único agente prioritario de ecommerce: referencia **40 h a USD 35/h = USD 1,400 brutos**, sujeta a descubrimiento de alcance. Si la demanda es una plataforma integral multicanal, **no** prometer 40 horas: estimar por fases. Sin confirmación del comprador, no declarar precio adjudicado.

## Matriz de certificación y cierres
- `INFRA_PASS`: pruebas CI y acceso a Vercel en el entorno consultado; no acredita producción de E1-E4.
- `SYNTHETIC_PASS`: prueba determinista de roles y evidencias; no acredita cliente ni acceso de producción.
- `CUSTOMER_DELIVERY_CERTIFIED`: requiere ejecución real trazada, pruebas completas E1/E2/E3, mitigación de bloqueos, aceptación firmada del cliente, y operación comprobada por A4/A2. No emitir mientras falte alguna puerta de control.
- Toda emisión diaria lleva fecha/hora de El Salvador, SHA Git, run ID, URL de artefactos, resultado de Vercel, motivos de HOLD, propietario y siguiente acción. En ausencia de pruebas, estado `BLOCKED`, no `PASS`.
- Los informes comerciales diarios de lunes a viernes son evidencia de actividad; no reemplazan certificado de ejecución.

## Regla de oro aplicada
Recuperar trabajo ya hecho → definir salida verificable → ejecutar pruebas que realmente correspondan al alcance → detectar bloqueos → corregir con RSI y ensayos sin efectos colaterales → conservar artefactos → certificar únicamente el resultado alcanzado → registrar aprendizaje. No vender una garantía de cero fallos.
