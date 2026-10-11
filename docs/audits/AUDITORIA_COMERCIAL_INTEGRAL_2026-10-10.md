# Auditoría comercial integral — Boltech Group
Fecha: 2026-10-10, El Salvador. Responsable: ChatGPT. Solicitante: Ricardo Bolaños.

## Instrucción de pruebas
Si se necesita un comprador de prueba, nombre exacto **Cliente Sintético**. La prueba debe quedar segregada, marcada QA, sin correos a personas reales, sin contratos/referidos genuinos, sin activar cobro ni contar ingresos. **En esta auditoría no se creó un Cliente Sintético porque la revisión read-only permitió identificar brechas sin ensuciar producción.** No se ejecutaron pruebas end-to-end de Wompi ni disparos a proveedores externos.

## Métodos y fuentes
- GitHub `main`: `docs/commercial/rsi_execution.md`, `primer_cobro.md`, `.github/workflows/mit_commercial_9am.yml`, `scripts/commercial/mit_daily_control_tower.mjs`, `traction_cycle.mjs`, `zero_to_first_sale.mjs`, `lib/rsi_agent_executor.js`.
- Airtable base Boltech CRM: `Leads` (214 observados antes de la reciente conciliación, luego 5/5 releídos), `RSI Agent Work` (5/5 registros de cohorte releídos), `Payment Orders` (2 registros observados).
- Gmail: cinco IDs de envío verificados y documentados en `docs/commercial/N8N_FREELANCE_OUTREACH_2026-10-10.md`.
- Limitación: no hubo acceso a los secretos de producción ni a logs completos de la última ejecución de Actions, ni prueba autenticada de todos los endpoints en este turno. Un archivo o estado COMPLETED no certifica integración completa.

## Matriz de control
| Etapa | Evidencia | Estado | Riesgo y acción |
|---|---|---|---|
| Descubrimiento y selección | Cinco oportunidades con mensajes aceptados por Gmail | PARCIAL | Vigencia/decisor y necesidad actual no confirmados; actualizar antes de reiterar |
| Contacto | Cinco identificadores Gmail SENT | VERIFICADO | SENT no acredita entrega ni respuesta |
| Conciliación | 5 Leads y 5 Work IDs RSI-01, reread | VERIFICADO | Son entradas creadas/actualizadas manualmente, no evidencia de sincronización automática |
| Duplicados | Upsert por Contact Email y Work ID | PARCIAL | Validar reconciliación también por empresa/dominio y pruebas con repetición |
| Ejecución RSI-01 | Arquitectura con Redis/Airtable, ciclo GitHub 09:00 | NO CERTIFICADO PARA COHORTE | Revisar recibos posteriores con los 5 source IDs, métricas y blockers |
| Recepción y respuesta | No se verificó respuesta real para estos 5 | NO CERTIFICADO | Conectar lectura de hilo Gmail, opt-out y clasificación de interés; excluir rebotes |
| RSI-02 | Recibo técnico de otro trabajo, sin alcance aceptado de esta cohorte | PARCIAL | Handoff solo con respuesta y autorización concretas |
| Cotización | Modelo exige alcance y autorización | PARCIAL | Validar gates, aceptación y cotización aprobada sin disparar pago |
| Wompi | Dos órdenes: una FAILED (producto flash viejo) y una PAID US$1 payment-verification, NOT_READY | PRUEBA DE PAGO CONFIRMADA; VENTA NO | No mezclar pago QA con venta ni entregar un agente |
| RSI-03 y cierre | Código y procedimiento existentes | NO CERTIFICADO E2E | Probar contrato→cotización aprobada→orden→webhook→conciliación→entrega, con dobles y sandbox cuando disponible |
| GitHub Actions | cron 15:00 UTC diario, pruebas y diagnóstico | CONFIGURADO, EJECUCIÓN ACTUAL NO CERTIFICADA | Verificar último run, outcome, artefactos, fallos y alarma |
| n8n | No se halló artefacto de ejecución que demuestre el tránsito por n8n | NO CERTIFICADO | Solicitar evidencia workflow ID/version, ejecuciones y errores, no atribuirle estas tareas |
| RSI continuo | funciones de diagnóstico, recibos, bloqueos y política de reintento | PARCIAL | Falta prueba de recuperación segura desde un fallo hasta el primer cobro |

## Defecto comercial prioritario
**El sistema evidencia actividad, no conversión verificada.** Se creó una cohorte de cinco y un work item por lead; no hay prueba del ciclo completo `SENT → DELIVERED/BOUNCED → REPLIED → QUALIFIED → PROPOSAL_APPROVED → CONTRACT → PAYMENT_PROVIDER_VERIFIED → DELIVERY`.

La respuesta de contacto debe detener seguimientos redundantes y pasar a calificación humana/RSI-02. Para un evento incierto no hacer reenvío automático; conciliación por identificador durable.

## Plan de remediación (orden)
P0 (antes del lunes 12): verificar último run de GitHub Actions y recibos RSI-01 posteriores a la conciliación; validar Gmail para rebotes/respuestas, hacer update de estados reales. Separar `sent` de `delivered`.
P1: implementar/validar conciliador idempotente Gmail→Airtable y cola de respuestas, sin que una preparación comercial genere correo. Pruebas de duplicados, timeout, 429, 500, caída de credenciales y recuperación.
P1: verificar permisos y enrutamiento n8n real; si n8n no participa, documentarlo como opcional y no dibujarlo como dependencia obligatoria.
P1: validar controles de cotización aprobada y flujo de respuesta→piloto; todo presupuesto y contrato requiere aprobación expresa.
P2: probar pago con proveedor en entorno aislado, simulando eventos con etiquetas **Cliente Sintético / QA**; bloquear inclusión en métricas y entrega real. No realizar cargos reales por esta auditoría.
P2: crear tablero con métricas respaldadas: enviados, rebotes, respuestas humanas, conversaciones, propuestas, acuerdos y efectivo comercial confirmado; N/D para fuentes inaccesibles.

## Criterio de aceptación
La auditoría end-to-end se considerará completada solo cuando existan recibos correlacionados por una ID estable de cada transición, prueba negativa de duplicado/replay y comprobación de que **Cliente Sintético** no alimenta ingresos, KPIs comerciales reales ni canales de terceros.

**Veredicto:** conciliación de cinco contactos confirmada; proceso comercial extremo a extremo NO CERTIFICADO. No se afirma funcionalidad al 100%.

## Ejecución correctiva (10 octubre 2026, posterior al dictamen original)

**Cambios aplicados a `main`:**

1. `lib/rsi_commercial_routes.js` reconoce `N8N_FREELANCE_YYYY-MM-DD` como cohorte de RSI-01. Antes la función `isCommercialCohort` la excluía: los cinco prospectos podían permanecer en Airtable sin figurar en la preparación RSI. El cambio solo incluye preparación, **no activa envíos**.
2. Se añadió exclusión nominal explícita de `Cliente Sintético` / `Cliente Sintetico` en `lib/rsi_commercial_routes.js`, `lib/rsi_agent_executor.js`, `lib/commercial_relay.js` y `lib/rsi03_closing.js`. Se mantienen las exclusiones ya existentes por `Data Quality = QA` y otras evidencias de prueba.
3. `tests/test_n8n_cohort.mjs` documenta los casos de cohorte de cinco, paso `Contacted`, protección del cliente sintético y ausencia de envío implícito. `.github/workflows/mit_commercial_9am.yml` incluye esta prueba en la etapa de regresión.
4. Cinco Leads y cinco work items ya conciliados en Airtable según `docs/commercial/N8N_FREELANCE_OUTREACH_2026-10-10.md`.

**Verificación incompleta, prohibido declarar PASS de producción:** el listado de Vercel durante la revisión mostró el despliegue del último commit `f126765` en estado `QUEUED`; los anteriores también en cola/compilación. No se ha obtenido aún resultado del workflow de GitHub Actions ni ejecución `RSI-01` posterior al despliegue que muestre los cinco prospectos. Tampoco se probó la recepción automática de nuevas respuestas, el encadenamiento RSI-02/03, el checkout y fulfillment de un caso íntegro. No se creó ni envió un cliente sintético.

**Limitación adicional identificada en fuente:** `lib/rsi01_followups.js` ejecuta una lista explícita `config/rsi01_followups.json` con comprobación `Experiment Cohort = RSI-01`; los cinco `N8N_FREELANCE` no quedan incluidos automáticamente en ese despachador. No deben introducirse a dicho plan sin autorización diferenciada de seguimiento y pruebas del conector Gmail. El reporte diario y la tarea de seguimiento de ChatGPT no equivalen a ejecución del despachador productivo.

**Bloqueos de aceptación:** CI PASS en último commit, deployment READY en último commit, diagnóstico RSI-01 con evidencia de cohorte en producción, conciliador de respuestas verificado, ejecución controlada de cotización y pago QA sin tocar dinero real ni contaminar métricas, y verificación de n8n si es una dependencia realmente desplegada. Hasta entonces: `FLUJO_COMERCIAL_E2E = NO_CERTIFICADO`.

## Segunda auditoría y solicitud de publicación — 10 de octubre de 2026

Se releyeron de `main` `lib/rsi_commercial_routes.js`, `tests/test_n8n_cohort.mjs`, `.github/workflows/mit_commercial_9am.yml` y el presente informe. La corrección de la cohorte `N8N_FREELANCE_2026-10-10` está en `main`, así como la protección `Cliente Sintético` y tres tests de regresión definidos (no equivale a afirmar ejecución de CI). El workflow MIT referencia las pruebas y tiene trigger `push` para esas rutas.

**Auditoría de despliegue:** Vercel confirmó el deployment `dpl_7ESZjKyarTVCnjzM3sgNCvV6Nz5g`, Git SHA `934fa2b0da42f57dc25e8499b08d1259ed7af6b5`, estado `BUILDING` en la lectura; otro deployment del workflow (SHA `ddb1af8`) figuraba `READY`, pero no contiene los cambios de cierre posteriores. Por tanto el estado de publicación del código consolidado aún es **NO CERTIFICADO**. El nuevo commit documental de esta segunda auditoría inicia por la integración GitHub→Vercel su propio proceso de despliegue; no confundir creación con estado READY.

**Resultado de auditoría:** 5 leads reales y sus 5 filas RSI-01 conciliados; la capa de preparación ahora reconoce su cohorte. No se ha confirmado ni el ciclo RSI-01 con recibo productivo posterior, ni los cinco seguimientos por Gmail, ni integración comprobada con n8n, ni un trayecto RSI-02→RSI-03→Wompi→fulfillment real. Se mantiene `E2E=NO_CERTIFICADO`, evitando cifras inventadas.

**Acción del próximo control:** abrir el último deployment de producción y verificar `READY`, revisar pruebas Actions, leer recibo RSI-01 de fecha posterior al despliegue, diagnosticar inbox Gmail y bloquear cualquier reenvío incierto. `Cliente Sintético` sigue reservado para simulación explícita y no se creó ni procesó aquí.
