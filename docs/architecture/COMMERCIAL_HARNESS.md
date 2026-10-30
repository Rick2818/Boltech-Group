# Harness comercial vigente — Boltech Group

**Versión:** Agente 1 V2, revisado 2026-10-30. **Estado:** PR #178 fusionado a `main` el 2026-10-20; CI del PR aprobado, pero autonomía comercial integral y conexión real de Explee aún no certificadas.

## Alcance actual
- **Agente 1 — Ventas:** investigación B2B, verificación de prospectos, contacto personalizado, respuestas, cotización, seguimiento y cierre comercial con autorización humana cuando corresponda.
- **Fuentes:** Apollo (lectura de cuenta verificada), Upwork (oportunidades dentro de la plataforma), Explee (archivo histórico y adaptadores API/MCP; autenticación en vivo pendiente).
- **Agente de Mercadeo:** señales de mercado, estrategia, generación de demanda y coordinación bidireccional con Ventas. No es un agente de cotización o seguimiento.
- **RSI:** Recursive Self-Improvement, limitado a Agente 1, con propuestas revisables; no despliega ni envía automáticamente. **No confundir con las antiguas denominaciones RSI-01/02/03.**

**Arquitectura vigente: exactamente dos agentes comerciales, Ventas y Mercadeo.** Las numeraciones y traspasos de la arquitectura anterior son exclusivamente históricos.

## Regla comercial obligatoria
Se entregará un lote **solo si hay exactamente cinco leads completos y verificados**. Investigar cinco empresas, registrar una oferta de Upwork o contar correos históricos no acredita cinco leads.
Cada contacto requiere empresa US, persona y cargo identificados, email empresarial, web/fuente comprobables, necesidad real con evidencia, verificación de correo y contacto, historial Gmail/CRM/supresión CLEAR, ausencia de duplicados y revisión de cumplimiento. Un registro incompleto permanece retenido individualmente; nunca se completa con datos sintéticos.
Los trabajos de Upwork usan el canal de propuesta de Upwork y no se convierten automáticamente en correos salientes.

## Harness y pruebas
- Composición: `lib/agent1_v2_executor.js`
- Fuentes: `lib/agent1_v2_lead_sources.js`, `lib/agent1_v2_explee_mcp.js`, `lib/agent1_v2_explee_live.js`
- Compuerta de calificación sin lote fijo (nombre de archivo conservado por compatibilidad): `lib/agent1_v2_five_lead_gate.js`
- Mejora recursiva controlada: `lib/agent1_v2_recursive_improvement.js`
- CI aislada: `.github/workflows/agent1_v2_market_skills_qa.yml`
- Las pruebas sintéticas certifican contratos de código, **no** autenticación real de Explee, envío Gmail o ejecución autónoma diaria.

## Límites
No modificar Wompi ni interrumpir ejecutores activos sin relevo certificado. Los cambios de código requieren PR, CI y revisión antes de llegar a `main`. No gastar créditos ni enviar correos sin verificación. Mantener historial y recibos verificables.

## Historial
La antigua documentación del harness basada en RSI-01/02/03 es **obsoleta para la reconstrucción del Agente 1** y no debe utilizarse como procedimiento comercial vigente. La historia queda recuperable mediante Git; otros módulos y pipelines heredados podrían seguir dependiendo de ella y necesitan migración y certificación antes de eliminarse.

Documentación transversal de ingeniería conservada: `docs/architecture/HARNESS_WORKFLOW.md`, `docs/architecture/HARNESS_AUTODOC.md` y `docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md`.
