# Archivo histórico — Sistema comercial anterior a Agent 1 V2
**Corte:** 2026-10-20
**Origen:** snapshot de la rama `main` antes de integrar la reconstrucción.
**Estado:** COPIA HISTÓRICA — no ejecutar desde esta rama.

Esta rama preserva el código, workflows, documentación y configuración existentes en `main` en el momento del corte. También conserva los historiales de Git. Su creación no suspende los ejecutores de producción ni modifica registros de CRM, Gmail, Wompi o Vercel.

## Componentes comerciales heredados a retirar *después* del relevo certificado
- Prospección: `lib/rsi01_*`, `lib/apollo_*`, `scripts/commercial/`, `scripts/outbound/`.
- Gestión del ciclo: `lib/rsi02_inbox_executor.js`, `lib/rsi03_closing.js`, `lib/rsi_commercial_routes.js`, `lib/commercial_*`.
- Orquestación, marketing, CRM y fuentes: requieren análisis de dependencias individuales; **no** eliminarlos en bloque.
- Ejecuciones programadas: `.github/workflows/asmas_rsi01_9am.yml`, `.github/workflows/rsi02-inbox-certification.yml` y demás tareas comerciales preexistentes: identificar propietarios y sustitución segura.
- Documentación histórica RSI-01/02/03: RSI aquí designaba antiguos módulos comerciales; **no** el nuevo Recursive Self-Improvement de Agent 1 V2.

## Criterio para dar de baja
Antes de desactivar un emisor/cron heredado: certificar la nueva orquestación con un ejecutor único, cinco leads reales plenamente verificados, persistencia idempotente, lectura y envío Gmail autorizado, CRM y relevos Agentes 2–4, recibos de QA y ejecución productiva observada.

**No desactivar ni borrar Wompi ni el Agente de Mercadeo.** No tocar ni perder datos comerciales, historial de correos, obligaciones de seguimiento o clientes existentes.
