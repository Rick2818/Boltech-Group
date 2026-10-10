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
