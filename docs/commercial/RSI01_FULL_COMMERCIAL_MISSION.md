# RSI-01: misión comercial de punta a punta — 2026-10-17

## Mandato y ejecución real
Objetivo: obtener cinco **oportunidades justificadas**, no cinco correos inventados. MARKETING genera/identifica candidatos; RSI-01 examina fuentes públicas y CRM, registra señales de procesos, investiga el responsable y solicita confirmación de necesidad a través de un contacto autorizado. RSI-02 diagnostica cuando el cliente realmente contesta. RSI-03 prepara propuesta, negociación y cierre; cobro requiere evidencia del proveedor de pagos. Coordinador central, Airtable como registro, un flujo CI y recibos.

## Pipeline y condiciones
1. **INVESTIGACION_SIN_SEÑAL:** sitio/organización real, sin evidencia operacional específica.
2. **POTENTIAL_NEED_SOURCE_OBSERVED:** web oficial muestra procesos complejos (cotización, especificaciones, soporte), con URL y fragmento guardados. Una señal **no es** dolor, intención ni compra.
3. **BUYER_RESEARCH:** corroborar persona, cargo, fecha y correo sin adivinar; cuando el correo y dominio no coincidan, conservar el bloqueo hasta validación alternativa. No omitir bajas ni contactos anteriores.
4. **CONTACT_READY_REVIEW:** caso real, evidencia y destinatario verificados; aprobación individual antes del primer contacto. El Agente 1 nunca se autoriza a sí mismo.
5. **NEED_CONFIRMED:** únicamente respuesta auténtica del cliente que describa su problema, frecuencia, impacto y responsable. No cambiar `Problem Confirmed` por señales inferidas.
6. **RSI-02:** alcance y análisis del problema confirmado, respuesta al cliente según autorizaciones.
7. **RSI-03:** propuesta, aceptación real y cierre. Cobro/entrega requieren recibos productivos separados.

## Mecanismo automático vigente
`.github/workflows/asmas_rsi01_9am.yml` a 09:00 SV: MARKETING → campaña RSI-01 con ledger diario (idempotencia de email) → investigación RSI-01 independiente (hasta cinco casos pendientes por ciclo) → RSI-02 y RSI-03. El ejecutor `lib/rsi01_public_research.js` lee el HTML público de la página principal aprobada, extrae señales limitadas y fragmentos reales; `lib/rsi01_research_executor.js` graba etapa, URL, razones pendientes y próxima acción en RSI Agent Work. No es un rastreador de redes sociales, buscador general, integrador Apollo con contactos pagados ni prueba de conversiones. No certifica cinco leads al día sin material suficiente.

## Reglas
Prohibido contactos sintéticos, auto-aprobaciones, envíos repetidos, necesidades inventadas o transferencias de un supuesto comprador. Conservar contactos previos y opt-outs. Estado de trabajo y resultados deben auditarse desde recibos de producción, no desde tests aislados. No tocar Wompi. Para ampliar investigación a subpáginas, usar lista autorizada de URLs o motor externo con límites SSRF, fuente, fecha, coincidencia de identidad y costos controlados.
