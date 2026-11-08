# Plantilla base de agentes — punto de partida para personalización

Fecha: 2026-11-05 · Estado: `DRAFT_FOR_OWNER_REVIEW`
Modelo: híbrido (plantilla base + personalización por cliente), según decisión del propietario.

---

## 1. Qué es la plantilla base

La plantilla base es el **agente genérico** que se configura por cliente. No se construye desde cero cada vez: se toma la plantilla, se ajustan las entradas, las salidas y las integraciones, y se entrega.

Las 6 especialidades de la landing (`config/funnel.json`) son la plantilla base actual:

| # | Especialidad | Agente | Tarea principal |
|---|---|---|---|
| 1 | Ventas | Agente de ventas | Seguimiento de oportunidades y preparación del siguiente paso comercial |
| 2 | Mercadeo | Agente de mercadeo | Preparación de materiales por audiencia con revisión humana |
| 3 | Operaciones | Agente de operaciones | Documentar y evaluar tareas repetitivas |
| 4 | Finanzas | Agente de finanzas | Conciliación y detección de diferencias |
| 5 | Logística | Agente de logística | Seguimiento de envíos y alertas |
| 6 | Servicio al cliente | Agente de servicio | Atención y seguimiento de solicitudes |

---

## 2. Estructura de la plantilla (común a todos los agentes)

Cada agente, sin importar la especialidad, tiene estos componentes:

### 2.1 Entrada (input)
- Fuente de datos (correo, WhatsApp, formulario, hoja de cálculo, API).
- Formato esperado (texto, JSON, archivo).
- Validación de campos obligatorios.

### 2.2 Procesamiento
- Lectura de la entrada.
- Extracción de campos (nombre, monto, fecha, ítem, etc.).
- Clasificación (tipo de solicitud, prioridad, estado).
- Detección de ambigüedades (marca para confirmación humana).

### 2.3 Salida (output)
- Registro en la herramienta del cliente (hoja, CRM, correo).
- Notificación al responsable.
- Estado visible para el equipo.

### 2.4 Supervisión humana
- Casos dudosos → confirmación humana.
- Acciones externas (enviar, comprar, pagar) → aprobación humana obligatoria.
- Errores → registro y notificación, no silencio.

### 2.5 Pruebas
- Suite de golden examples (mín. 10, incl. 3 casos límite).
- Juez LLM (≥90% por criterio, ≥95% promedio).
- Simulación de herramientas.
- Pruebas de seguridad.

---

## 3. Cómo se personaliza para un cliente

### Paso 1: Diagnóstico (1 sesión)
- ¿Qué tarea repetitiva duele más?
- ¿Qué herramientas usa hoy? (correo, WhatsApp, hojas, CRM)
- ¿Quién es el responsable de la tarea?
- ¿Qué resultado aceptaría como éxito?

### Paso 2: Selección de plantilla
- Elegir la especialidad más cercana (ventas, operaciones, finanzas, etc.).
- Si ninguna encaja, usar "agente a medida" (cotización por alcance).

### Paso 3: Configuración (1–3 días)
- Ajustar entradas (fuentes de datos del cliente).
- Ajustar salidas (herramienta del cliente).
- Definir el criterio de aceptación por escrito.
- Configurar la supervisión humana.

### Paso 4: Pruebas (1–2 días)
- Ejecutar la suite de golden examples.
- Evaluar con juez LLM.
- Simular herramientas.
- Revisar casos fallidos y ajustar.

### Paso 5: Entrega (1 sesión)
- Despliegue en la infraestructura del cliente (decisión B).
- Sesión de capacitación (decisión C).
- Entrega del recibo (ID, versión, suite, % aprobación, quién aprobó).
- Guía de uso.

### Paso 6: Seguimiento (primeros 30 días)
- Muestreo al 50% (después de un cambio).
- Ajustes según feedback.
- Paso a muestreo al 10% (operación normal).

---

## 4. Las 3 tareas de operaciones como plantillas concretas

Ya existen 3 plantillas listas (aprobadas por Ricardo):

| Tarea | Plantilla | Criterio de aceptación |
|---|---|---|
| Registro de pedidos | `commercial/operaciones/01-pedidos.md` | 20 pedidos de prueba sin duplicados ni pérdidas, <2 min/pedido |
| Conciliación de facturas | `commercial/operaciones/02-facturas.md` | 30 facturas con diferencias sembradas, todas detectadas |
| Alertas de stock | `commercial/operaciones/03-stock.md` | 30 días simulados sin quiebres en ítems con mínimo definido |

Estas 3 plantillas son el punto de partida para cualquier cliente de operaciones.

---

## 5. Qué se reutiliza y qué se personaliza

| Se reutiliza (plantilla) | Se personaliza (por cliente) |
|---|---|
| Estructura del agente (entrada → procesamiento → salida → supervisión) | Fuentes de datos (correo, WhatsApp, hoja) |
| Suite de pruebas base | Criterio de aceptación específico |
| Pruebas de seguridad | Herramienta de registro (hoja, CRM) |
| Formato del recibo | Notificaciones (a quién, por qué canal) |
| Reglas de claims y consentimiento | Integraciones (Gmail, Sheets, etc.) |

---

## 6. Integraciones propuestas (requieren validación técnica)

Las 10 fichas de integración (`commercial/integraciones/`) son posibilidades, no certificaciones:

Airtable, Gmail, Google Drive, Google Sheets, HubSpot, n8n, Notion, Slack, Supabase, Telegram.

Cada una está marcada como `PROPOSED_REQUIRES_TECHNICAL_VALIDATION`.

---

## 7. Límites

- La plantilla base no es un producto terminado: requiere configuración por cliente.
- Las integraciones no están certificadas: requieren validación técnica.
- La plataforma de terceros (n8n/Make) es una recomendación, no una decisión final de implementación.
- Requiere aprobación del propietario antes de usarse como estándar.
- El agente no certifica cumplimiento legal ni de integraciones.
