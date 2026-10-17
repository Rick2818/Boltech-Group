# Orden aceptada, ejecución supervisada y entrega — 16 octubre 2026

## Decisión y alcance
Por instrucción de Ricardo se reutilizan RSI-03, Redis, `/api/partners`, el workflow de entrega y el harness. No se añade otro coordinador, cron, base de datos ni modelo facturable. Wompi y sus callbacks no se modifican. No se promete generación automática de un agente a medida sin conocer el trabajo. Implementación supervisada: el responsable técnico prepara código específico del pedido y aprueba una revisión exacta antes de ejecutar build/QA en Actions.

## Recorrido implementado
1. RSI-03 verifica la aceptación de su propuesta; registra automáticamente la orden durable, con alcance, criterios y referencia al mensaje real. Si el registro falla, el siguiente ciclo vuelve a conciliar la misma orden; SET NX y huella del alcance impiden duplicación o sustitución.
2. El responsable técnico implementa el pedido en el repositorio. Operación autenticada `approve-plan` vincula responsable, SHA inmutable y un archivo de pruebas por criterio aprobado. El plazo se calcula desde la aprobación del plan y accesos. No se ejecuta código arbitrario recibido por correo.
3. El workflow existente `Client delivery certification (GitHub + Vercel)` se ejecuta manualmente en main, modo customer y order_id. Lee el plan en Vercel; otro job sin secretos operacionales hace checkout del SHA aprobado, instala dependencias sin scripts de instalación, ejecuta el build y los tests aprobados. Guarda fuente versionada (api/lib/config/tests/package) y recibo real como artifact. El código del cliente no recibe PARTNER_API_TOKEN.
4. El job final con código de main solicita `qa`; Vercel verifica por API GitHub el workflow, origen, rama main, job ejecutado con éxito y artifact ligado a orden+SHA. Un fallo no produce QA_PASSED. Reejecutar el workflow recupera trabajo fallido sin enviar correos ni crear cobros. Un fallo deja BLOCKED. El responsable puede aprobar un nuevo SHA antes de entregar; se conserva el plan anterior y se invalida su QA. No se altera silenciosamente un plan ejecutado.
5. `payment` consulta el ledger de pagos existente: requiere mismo orderId, producto, cuenta, importe y evidencia productiva del proveedor. Solo registra; no confirma pagos por texto del cliente.
6. `deliver` exige QA_PASSED, pago confirmado y mensaje real en Enviados dirigido al comprador, con referencia de cotización y enlace a evidencia. No envía automáticamente ni identifica el correo de pago como entrega.
7. `accept-delivery` requiere respuesta humana del comprador en el hilo de entrega, posterior a la entrega, con `ACEPTO ENTREGA <orderId>`. La aceptación de la oferta no equivale a aceptación de entrega.

## API existente ampliada
`GET /api/partners?action=client-order&orderId=...` devuelve orden o 404. `POST` admite `register` con opportunityId, o `approve-plan`, `qa`, `block`, `payment`, `deliver`, `accept-delivery` con orderId, expectedVersion, eventId y datos de la operación. Autenticación operacional obligatoria; no usar credenciales A2A. Versiones CAS evitan sobrescrituras y eventId evita repetir operaciones. Caída de almacenamiento/API conserva bloqueo explícito; sin fallback en memoria.

## Estados independientes
- execution: WAITING_IMPLEMENTATION → READY_FOR_BUILD_AND_QA → QA_PASSED; BLOCKED admite recuperación QA.
- payment: UNVERIFIED → PAID.
- delivery: NOT_DELIVERED → DELIVERED.
- customerAcceptance: PENDING → ACCEPTED.
El antiguo fulfillmentStatus del ledger sigue describiendo la notificación de pago por compatibilidad; el estado del servicio se lee exclusivamente en la orden de entrega nueva.

## Harness: diagnóstico confirmado
El 16 octubre a las 18:02 SV la issue #86 ya se actualizaba automáticamente. Los runs 38984376333 y 38984484857 terminaron success. El probe registró SHA productivo correcto, pero `GMAIL_OAUTH_INVALID_GRANT`. Éxito del publicador no equivale a Gmail operativo. La conexión Gmail de ChatGPT que envió NUBO es independiente del refresh token Vercel. El harness ahora expone ATTENTION_REQUIRED y el código de bloqueo en primer plano; sigue sin editar código, cambiar credenciales ni activar campañas por su cuenta. Esto es su alcance de diseño, no un ejecutor de desarrollo autónomo.

## Certificación
Pruebas de contratos, concurrencia, reinicio, fallos de proveedor y ejecución real de build/QA sobre un repositorio de prueba se realizan en CI. Un PASS técnico no acredita entrega de NUBO, aceptación humana, pago ni la semana supervisada de la Regla de Oro. La certificación de un cliente requiere su alcance, código específico, accesos y recibos reales. No existe todavía ese pedido.
