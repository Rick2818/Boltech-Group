# Resumen ejecutivo — Plan Comercial tipo Relevance AI

Fecha: 2026-11-05 · Estado: `CLOSED` / `REVIEW_REQUIRED` (publicación) · Presupuesto: **US$0**
Equipo: **Ricardo (propietario y ventas) + agente (operación, redacción y técnica)**
> Cierre formal: ver `docs/CIERRE-PLAN-COMERCIAL.md`. El plan está **CERRADO** desde el 2026-11-05; la publicación sigue desactivada.

---

## 1. Resumen ejecutivo

Se reconstruyó como código original el mecanismo comercial de los embudos enterprise públicos
(Langflow y Relevance AI): entrada de bajo roce, contenido por tarea concreta, cualificación por
escrito y oferta sin precio público.

| Dimensión | Estado |
|---|---|
| Oferta | 3 servicios: implementación, agente a medida, soporte — todos a cotización |
| Recorridos | 2: `adoption-services` (Langflow) y `solution-led` (Relevance AI) |
| Primera puerta | Operaciones, con 3 tareas aprobadas |
| Piezas | 22 por kit + 3 fichas de operaciones (ES/EN) + 10 fichas de integración (ES/EN) |
| Pruebas | 52/52 pasan |
| Gasto | US$0 |
| Publicado | Nada |
| Datos reales recibidos | Ninguno |

**Diferencia con un CRM:** aquí no se vende solo; el sistema prepara, registra y mide. La decisión
y la conversación son humanas.

---

## 2. Cómo se ejecutan las acciones

Todo se ejecuta por comandos con Node. No hay servidor, cron ni tarea en segundo plano.

| Acción | Comando | Automático |
|---|---|---|
| Generar el kit de contenido | `commercial-build` | Sí |
| Validar el embudo | `funnel-check` | Sí |
| Generar la landing | `funnel-build` | Sí |
| Registrar una solicitud consentida | `commercial-capture --file x.json` | Sí |
| Calcular métricas | `commercial-metrics --tenant boltech` | Sí |
| Ejecutar un objetivo completo | `agent-run --file objective.json` | Sí, hasta el gate |
| Reanudar un objetivo bloqueado | `agent-resume --id ID` | Sí |
| Aprobar material | `approve --tenant T --event E --operator HUMAN` | **No: humano** |
| Entregar a cola interna | `handoff --tenant T --event E` | **No: humano** |
| Avanzar de etapa | `advance --tenant T --opportunity ID --stage STAGE` | **No: humano** |

Máquina de estados de una oportunidad:

```
CAPTURED → QUALIFIED → MATERIAL_READY → PROPOSAL_PREPARED →
PROPOSAL_AUTHORIZED → SENT → REPLIED → NEGOTIATION → WON
```

`SENT` solo es alcanzable por un adaptador autorizado, nunca de forma automática.

---

## 3. Sí, existe un agente — y esto es exactamente lo que hace

`ObjectiveRunner` (`src/agent.mjs`) ejecuta seis pasos persistidos:

| Paso | Qué hace |
|---|---|
| `capture_opportunity` | Registra la oportunidad con origen, canal y tenant |
| `draft_material` | Genera el borrador y lo deja en `DRAFT_REVIEW_REQUIRED` |
| `qualify` | Mueve la oportunidad a `QUALIFIED` |
| `material_ready` | Mueve a `MATERIAL_READY` |
| `verify` | Comprueba que el material sigue sin aprobar |
| `human_gate` | **Se detiene y exige aprobación humana** |

Características reales:
- Si un paso falla, el objetivo queda `BLOCKED` con el error y se reanuda con `agent-resume`.
- Es idempotente: el mismo evento no crea dos objetivos.
- El resultado declara literalmente: *"Draft is queued for human review; no approval or external
  send was performed by the agent."*

**Lo que el agente no hace:** aprobar, enviar correos, publicar, contactar terceros, negociar,
cobrar o gastar.

---

## 4. ¿Quién hace el mercadeo?

| Actividad | Quién |
|---|---|
| Redactar piezas (fichas, comparativas, copy) | **Agente** |
| Auditar claims prohibidos | **Agente** |
| Decidir a quién le hablamos | **Ricardo** |
| Aprobar el copy | **Ricardo** |
| Publicar o enviar | **Nadie todavía** (canales cerrados) |

Los cinco canales están definidos pero desactivados: `a2a`, `organic-web`,
`institutional-linkedin`, `marketplaces`, `partner-programs`.

En una frase: **el agente produce borradores; el mercadeo como actividad pública todavía no existe.**

---

## 5. Cómo se miden los KPI

Dos capas, ambas calculadas **solo desde registros persistidos**.

### 5.1 Embudo general — `metrics`

| KPI | Cómo se calcula |
|---|---|
| `captured` | Total de oportunidades registradas |
| `qualified` | Oportunidades que pasaron por `QUALIFIED` |
| `materialReady` | Pasaron por `MATERIAL_READY` |
| `proposalsPrepared` | Pasaron por `PROPOSAL_PREPARED` |
| `proposalsAuthorized` | Pasaron por `PROPOSAL_AUTHORIZED` |
| `sent` / `replied` / `negotiation` / `won` / `lost` / `disqualified` | Conteo por etapa |
| `captureToQualified`, `qualifiedToProposal`, `proposalToSent`, `sentToReply`, `replyToWon`, `overallCaptureToWon` | Cocientes; `null` si el denominador es 0 |
| `verifiedRevenueByCurrency` | Solo `WON` con `revenue.verified` |

### 5.2 Por recorrido — `commercial-metrics --tenant boltech`

Por cada playbook: `realOpportunities`, `qualified`, `proposalsPrepared`, `sent`, `replied`, `won`,
`captureToQualified`, `captureToWon`, `verifiedRevenueByCurrency`.

Reglas de honestidad aplicadas por el código:
- Los registros `synthetic` se excluyen de toda métrica comercial.
- Visitas y conversión visita→solicitud devuelven **`null`** hasta conectar medición web.
- Ingresos solo con etapa `WON` y monto verificado.
- Se declara lo no disponible: `operatingCosts`, `externalA2ADeliveries`, `realCustomers`.

**Estado real hoy:** capturado = 0, oportunidades reales = 0, ingresos = 0. Cualquier cifra
distinta sería inventada.

---

## 6. ¿Quién es responsable de que se venda?

**Ricardo.** No hay agente de ventas y el sistema no puede vender por diseño.

- Ricardo recibe, cualifica, negocia y cierra.
- Ricardo aprueba material, propuesta y envío.
- El agente solo prepara, registra y mide.
- `PROPOSAL_AUTHORIZED → SENT` exige acción humana con adaptador autorizado.

---

## 7. Bloqueos actuales

| Bloqueo | Consecuencia |
|---|---|
| Texto legal sin aprobar | No se pueden recibir datos reales |
| Destino de datos sin definir | No hay dónde registrar una solicitud real |
| Base legal sin definir | No se puede contactar a nadie |
| Dominio y hosting sin autorizar | Nada se publica |
| 0 oportunidades reales | Los KPI miden cero |

---

## 8. Próximos hitos (30 días)

1. ~~10 fichas de integración~~ — hechas: `docs/INTEGRACIONES-10.md` y `commercial/integraciones/`.
2. ~~Ruta de solicitud probada con datos sintéticos~~ — hecha: `docs/PRUEBA-RUTA-SOLICITUD.md`.
3. ~~Métricas con reporte por tenant~~ — hechas: 0 reales, 3 sintéticas excluidas.
4. Primeras 3 conversaciones comerciales reales — **bloqueado** por las 3 decisiones legales
   (`docs/DECISIONES-LEGALES.md`).

**Definición de terminado del plan:** oferta aprobada, piezas revisadas, ruta probada, métricas
activas y responsables asignados. Hoy faltan los últimos tres.
