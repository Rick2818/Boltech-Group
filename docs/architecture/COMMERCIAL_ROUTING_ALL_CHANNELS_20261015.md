# Enrutamiento comercial central — ampliación controlada 2026-10-15
Estado: **PARTIALLY_IMPLEMENTED / NOT PRODUCTION CERTIFIED**.

Alcance autorizado: todas las fuentes de oportunidades comerciales existentes. Modulo puro `lib/commercial_intake_router.js` con contrato `routeCommercialIntake` para `web, apollo, gmail, a2a, upwork, whatsapp, other`; tests offline `tests/test_commercial_intake_router.mjs`; CI `.github/workflows/commercial-routing-synthetic.yml`. No autoriza mensajes ni precios. No constituye conexión real de esas fuentes.

## Flujo objetivo
Fuente -> validación de contacto/consentimiento -> identidad y deduplicación -> clasificador determinista -> ejecutor de traspaso durable con readback -> destinatario RSI-01/02/03 (acuse) -> controles técnicos/comerciales vigentes -> cotización aprobada -> Wompi -> pago confirmado -> ejecución y QA.

Clasificación:
- General/indefinida -> RSI-01.
- Custom o diagnóstico -> RSI-02, con RSI-03 en etapa de cierre.
- Prebuilt con alcance completo -> RSI-03, pero sin autorización de emitir precio.
- Cotización ya aceptada: RSI-03 únicamente si aprobación y referencia están verificadas; de lo contrario RSI-02 para resolver faltantes.
- Sin contacto validado y consentimiento explícito no hay alcance saliente; permisos de envío se verifican por separado.

## Pruebas y dependencias
- Pruebas sintéticas offline cubren todas las fuentes, varias intenciones, consentimiento, control de precio/pago, entradas inválidas; CLIENTE SINTÉTICO no es venta ni mensaje enviado.
- **Pendiente antes de certificación:** cableado de adaptadores de cada entrada al módulo, identificación y lease/outbox durables, acuse real de cada RSI, reconciliación y reintentos, casos de integración y prueba sobre commit desplegado en Vercel; la CI debe confirmar PASS por evidencia de ejecución.
- No activar APIs de pago (presupuesto USD0) ni reenvío comercial por crear la política.
- Los handoffs actuales en `lib/rsi_handoff_store.js` solo permiten determinadas rutas entre RSI; no aceptan origen WEB/APOLLO/GMAIL/A2A/UPWORK/WHATSAPP. **Bloqueo identificado:** se debe extender el adaptador preservando la semántica CAS/idempotencia y el control de autenticación, no suponer que el router ya transfiere al RSI.

Este archivo documenta una implementación parcial reversible en rama y no certifica E2E.
