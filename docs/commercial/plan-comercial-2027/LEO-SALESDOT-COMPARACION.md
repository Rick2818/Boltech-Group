# Comparación Leo / Sales Dot aprobado

Fecha: 2026-11-08

Esta revisión compara el contrato local previamente aprobado para Sales Dot con
el runtime actual de Cloudflare Leo. El repositorio anterior fue inspeccionado;
no se modificó, desplegó ni reactivó.

## Matriz de brechas

| Capacidad | Antes aprobado | Leo tras la revisión | Estado |
|---|---|---|---|
| Identidad y bilingüismo | Leo / Boltech, español e inglés | Conservado en `LEO_SYSTEM` y la interfaz | Cumple |
| Preguntas secuenciales | Proceso, herramientas, volumen, resultado/plazo, correo | `salesDotReply()` conserva ese orden | Cumple |
| Correo válido | Requerido para completar | Valida formato y vuelve a pedirlo si es inválido | Cumple |
| Resumen estructurado | Problem, tools, volume, goal, email | Devuelve los cinco campos | Cumple |
| Estado de cotización | `PENDING_APPROVAL` | Devuelto solo al completar el Sales Dot | Cumple |
| Responsable comercial | `AGENT_1` | Devuelto en el resumen | Cumple |
| Fábrica/pedido | `NOT_ORDERED` | Devuelto en el resumen | Cumple |
| Envío, venta y cobro | Prohibidos | `authorizedActions: []`; no hay ejecutor | Cumple |
| Rechazo y seguimiento | Detener contacto ante rechazo | `STOPPED` / `STOP_FOLLOW_UP` en conversion runtime | Cumple |
| Objeciones y escalamiento | No inventar; escalar a Ricardo | Guards de refund, seguridad, queja y autonomía | Cumple |
| PII | No guardar sin consentimiento | Guard explícito; el resumen permanece en la sesión | Cumple |

## Archivos de referencia

- Anterior: `C:\Users\Ricardo\Desktop\Boltech-Group\lib\sales_dot_pilot.js`.
- Anterior: `C:\Users\Ricardo\Desktop\Boltech-Group\docs\PROMPT-AUDITORIA-SKILLS-LEO.md`.
- Actual: `src/leo_sales_runtime.mjs`.
- Actual: `functions/api/index.js`.
- Actual: `public/sales-agent.html`.

## Limitaciones pendientes

- La cotización, el correo, la reunión y el pedido siguen siendo pasos humanos;
  completar el resumen no crea un lead ni envía una comunicación.
- La cadencia documentada de seguimiento permanece desactivada en este proyecto;
  un rechazo no autoriza ningún envío.
- No se ejecutaron proveedores externos, pagos, campañas ni mensajes reales.
