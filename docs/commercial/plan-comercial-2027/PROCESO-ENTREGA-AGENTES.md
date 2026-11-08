# Proceso de entrega de agentes — decisiones tomadas

Fecha: 2026-11-05 · Estado: `DECIDIDO (2026-11-05)`
Este documento registra lo que **no está definido** en el plan comercial: cómo se crea, dónde corre
y cómo se entrega un agente al cliente.

---

## 1. Lo que SÍ está definido

- La oferta: implementación de un flujo, agente a medida, soporte y seguimiento.
- El criterio de aceptación: escrito antes de empezar.
- El embudo comercial: captura → cualificación → propuesta → cotización → aceptación y pago.
- Los recorridos y las 22 piezas de material.
- El formulario y el consentimiento.

## 2. Lo que NO está definido (y bloquea la entrega)

### A. ¿Los agentes ya existen o se crean por proyecto?

| Opción | Qué implica | Riesgo |
|---|---|---|
| A. Agentes preconstruidos (plantillas) | Se configuran por cliente (como las 6 especialidades de la landing) | Limitado a casos conocidos |
| B. Agentes a medida por proyecto | Se diseñan y construyen por solicitud | Mayor costo y tiempo; requiere capacidad técnica |
| C. Híbrido | Plantilla base + personalización | Balance; requiere definir la plantilla |

**Decidido (2026-11-05):** ver firma

### B. ¿Dónde corre el agente?

| Opción | Qué implica | Riesgo |
|---|---|---|
| A. En la infraestructura de Boltech (SaaS) | Boltech hospeda; el cliente accede por web/API | Boltech asume costo de hosting y operación |
| B. En la infraestructura del cliente | Se despliega en la cuenta del cliente | Cliente controla datos; Boltech da soporte |
| C. En ambas (opción del cliente) | Flexible | Mayor complejidad de soporte |

**Decidido (2026-11-05):** ver firma

### C. ¿Cómo se despacha al cliente?

| Opción | Qué implica | Riesgo |
|---|---|---|
| A. Entrega de credenciales + guía | El cliente opera solo | Soporte reactivo |
| B. Despliegue acompañado + capacitación | Sesión de entrega + documentación | Mayor tiempo por proyecto |
| C. Acceso a plataforma (dashboard) | El cliente ve su agente en un panel | Requiere construir el panel |

**Decidido (2026-11-05):** ver firma

### D. ¿Qué plataforma/stack se usa?

| Opción | Qué implica |
|---|---|
| A. Plataforma propia (Boltech) | Control total; alto costo de desarrollo |
| B. Plataforma de terceros (n8n, Make, Langflow, etc.) | Menor costo; dependencia del proveedor |
| C. Híbrido (propio + terceros) | Flexibilidad; mayor complejidad |

**Decidido (2026-11-05):** ver firma

### E. ¿Quién construye el agente?

| Rol | Asignado actual | Capacidad |
|---|---|---|
| Propietario (Ricardo) | Aprueba alcance y precio | No construye |
| Agente (técnico) | Implementa, valida, ejecuta builds | Capacidad limitada (2 personas) |

**Pregunta:** ¿Se contrata un desarrollador externo para la construcción? ¿Se usa un proveedor de plataforma?

**Decidido (2026-11-05):** ver firma

---

## 3. Lo que el plan actualmente dice (y no resuelve)

- `docs/PLAN-DE-ACCION.md` §1: "Implementación de un flujo: mapa del proceso, configuración acordada, pruebas con criterio de aceptación, guía de uso."
- `docs/OPERACIONES-3-TAREAS.md`: define las 3 tareas y sus criterios de aceptación.
- `commercial/operaciones/`: fichas con criterio de aceptación por tarea.
- **Pero no dice:** dónde corre el agente, quién lo construye, cómo se entrega, qué plataforma se usa.

---

## 4. Decisión tomada (2026-11-05)

Antes de publicar o recibir datos reales, Ricardo debe decidir:

1. **Modelo de entrega:** ¿plantilla + configuración (rápido, limitado) o a medida (flexible, costoso)?
2. **Hosting:** ¿Boltech hospeda o el cliente? (Afecta costo, privacidad y soporte.)
3. **Plataforma:** ¿propia o de terceros? (Afecta tiempo de desarrollo y dependencia.)
4. **Capacidad:** ¿contratar desarrollador o usar plataforma no-code?

**Sin estas decisiones, el plan comercial promete algo que no se puede entregar.**

---

## 5. Límites

- El agente no puede decidir la plataforma ni el modelo de entrega.
- El agente no puede construir agentes sin definir el stack.
- Este documento es un registro de preguntas abiertas, no una respuesta.
- Requiere decisión del propietario antes de continuar.

---

## 6. Firma

| Decisión | Opción elegida | Fecha | Aprobó |
|---|---|---|---|
| A. Origen del agente | Híbrido (plantilla + personalización) | 2026-11-05 | Ricardo |
| B. Dónde corre | En infraestructura del cliente | 2026-11-05 | Ricardo |
| C. Cómo se despacha | Despliegue acompañado + capacitación | 2026-11-05 | Ricardo |
| D. Plataforma/stack | De terceros (n8n/Make) | 2026-11-05 | Ricardo |
| E. Quién construye | Agente construye, Ricardo aprueba | 2026-11-05 | Ricardo |
