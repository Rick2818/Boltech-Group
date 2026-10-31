# Harness comercial vigente — Boltech Group

**Versión:** Agente 1 V2, 2026-10-20 (contrato actualizado el 2026-10-30). **Estado:** código integrado en `main`; la certificación comercial E2E requiere evidencias independientes de ejecución real.

## Alcance actual
- **Agente 1 — Ventas:** investigación B2B, verificación de prospectos, contacto personalizado, respuestas, cotización, seguimiento y cierre comercial con autorización humana cuando corresponda.
- **Fuentes:** Apollo (lectura de cuenta verificada), Upwork (oportunidades dentro de la plataforma), Explee (archivo histórico y adaptadores API/MCP; autenticación en vivo pendiente).
- **Agente de Mercadeo:** señales de mercado, estrategia, generación de demanda y coordinación bidireccional con Ventas. No es un agente de cotización o seguimiento.
- **RSI:** Recursive Self-Improvement, limitado a Agente 1, con propuestas revisables; no despliega ni envía automáticamente. **No confundir con las antiguas denominaciones RSI-01/02/03.**

**Arquitectura vigente: exactamente dos agentes comerciales, Ventas y Mercadeo.** Las numeraciones y traspasos de la arquitectura anterior son exclusivamente históricos.

## Regla comercial obligatoria
La investigación y calificación **no tienen límite fijo de cinco leads ni exigen completar un lote**. Cada oportunidad se evalúa individualmente; una ejecución del ciclo no acredita prospectos nuevos sin evidencia verificable. La liberación para investigación no autoriza envíos ni gasto de créditos.
Cada contacto requiere empresa US, persona y cargo identificados, email empresarial, web/fuente comprobables, necesidad real con evidencia, verificación de correo y contacto, historial Gmail/CRM/supresión CLEAR, ausencia de duplicados y revisión de cumplimiento. Cuatro de cinco significa **lote retenido**, nunca completado artificialmente.
Los trabajos de Upwork usan el canal de propuesta de Upwork y no se convierten automáticamente en correos salientes.

## Harness y pruebas
- Composición: `lib/agent1_v2_executor.js`
- Fuentes: `lib/agent1_v2_lead_sources.js`, `lib/agent1_v2_explee_mcp.js`, `lib/agent1_v2_explee_live.js`
- Compuerta: `lib/agent1_v2_five_lead_gate.js` (nombre histórico de compatibilidad; exporta `releaseVerifiedProspects` sin lote fijo)
- Mejora recursiva controlada: `lib/agent1_v2_recursive_improvement.js`
- CI aislada: `.github/workflows/agent1_v2_market_skills_qa.yml`
- Las pruebas sintéticas certifican contratos de código, **no** autenticación real de Explee, envío Gmail o ejecución autónoma diaria.

## Límites
No modificar Wompi, Marketing ni `main` mediante este reemplazo documental. No gastar créditos ni enviar correos sin verificación. Mantener historial y recibos verificables.

## Historial
La antigua documentación del harness basada en RSI-01/02/03 es **obsoleta para la reconstrucción del Agente 1** y no debe utilizarse como procedimiento comercial vigente. La historia queda recuperable mediante Git; otros módulos y pipelines heredados podrían seguir dependiendo de ella y necesitan migración y certificación antes de eliminarse.

Documentación transversal de ingeniería conservada: `docs/architecture/HARNESS_WORKFLOW.md`, `docs/architecture/HARNESS_AUTODOC.md` y `docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md`.
