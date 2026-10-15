# Harness — Cuatro áreas integradas de Boltech Group

**Decisión de arquitectura:** 2026-10-15. Alcance: estructura funcional y criterios de aceptación; documentar no certifica despliegues ni corrige bloqueos.

## Las cuatro áreas

| Área | Propósito | Control de salida |
|---|---|---|
| 1. Web App | Presentar servicios, recibir solicitudes y abrir oportunidades | Solicitud autenticada o validada, consentimiento aplicable, opportunityId, origen y recibo de ingreso |
| 2. Comercial | RSI-01 prospección y calificación; RSI-02 diagnóstico y propuesta; RSI-03 aprobación, aceptación y cierre comercial | Evidencia de comprador/contacto, deduplicación, historial, aprobación individual, alcance/precio y aceptación |
| 3. Producción, ejecución y entrega | Programar pedido, asignar ejecutor responsable, realizar trabajo, verificar QA, certificar y entregar | Pedido aprobado, responsable explícito, hitos E1–E4, pruebas, recibos y aceptación/entrega verificadas |
| 4. Cobros y conciliación | Generar la obligación, emitir instrucción/enlace autorizado (Wompi), consultar confirmación del proveedor, conciliar y registrar pagos | Idempotencia, comprobante verificable del proveedor, referencia de pedido, monto/moneda y estado de conciliación |

## Recorrido y contratos

La secuencia conceptual es **Web App → Comercial → Producción/Entrega ↔ Cobros**. El cobro de anticipo puede preceder la producción, según las condiciones aceptadas; el saldo puede cobrarse en hitos o tras entrega. No iniciar obligaciones ni declarar pago por un webhook no verificado.

Cada pedido conserva `opportunityId`, `orderId`, `customerId`, `stage`, `owner`, `authorizationRef`, `evidenceRefs`, `updatedAt`, `nextAction` y `idempotencyKey`; cada transición emite `eventId`, origen/destino, resultado y recibo durable. El coordinador evita pedidos huérfanos, colas sin ejecutor y saltos de etapa.

## Puntos de control y recuperación

1. **Ingreso:** rechazar spam/duplicados, separar CLIENTE SINTÉTICO de clientes reales.
2. **Comercial:** no convertir un correo propio en respuesta de comprador; no enviar sin validación/autorización; una respuesta incierta se concilia antes de reintentar.
3. **Producción:** ejecutar programación → trabajo → QA → certificación → entrega; cada etapa con ejecutor, resultado, evidencia y mecanismo de recuperación. Un fallo de QA retorna al ejecutor y no genera certificado.
4. **Cobro:** verificar firma/estado y monto con Wompi; conciliar contra pedido y recibos; reintentos idempotentes, sin cobros duplicados ni ingresos sintéticos reportados como reales.
5. **Observabilidad:** GitHub Actions / Vercel exponen estados de cada subsistema. `READY` o workflow `SUCCESS` por sí solos **no** certifican un pedido o una venta. Un agente con `outcome=BLOCKED` debe registrarse como bloqueo y nunca certificarse `PASS` comercial.
6. **Autorreparación autorizada:** diagnosticar, aplicar cambios reversibles y seguros dentro del alcance, probar, registrar PR/commit/recibo; escalar permisos, OAuth, gastos o decisiones comerciales fuera del permiso. No saltarse controles para obtener indicadores verdes.

## Prueba sintética integral requerida

Crear caso **CLIENTE SINTÉTICO** sin contacto a terceros ni cargo real: solicitud web → CRM → RSI-01 → RSI-02 → RSI-03 con aprobación simulada claramente marcada → pedido → programación → ejecutor → QA (inyectar fallo y recuperación) → certificación de entrega → simulación de obligación y conciliación de pago sin llamar a Wompi real. Emitir un recibo por etapa, demostrar ausencia de duplicados e invalidar cualquier paso sin evidencia.

**Certificación real:** requiere por separado pruebas con proveedores y cuentas autorizadas (Gmail, CRM, Wompi), identificación del commit de producción, evidencias end-to-end y conciliación. Un fixture no acredita conectores de producción.

## Referencias vigentes

- [Procedimiento del Harness](HARNESS_WORKFLOW.md)
- [Harness comercial](COMMERCIAL_HARNESS.md)
- [Certificación de entrega](HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md)
