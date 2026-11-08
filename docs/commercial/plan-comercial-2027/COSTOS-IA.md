# Costo de la IA y autonomía — regla de cotización

Actualizado: 2026-11-06

Sirve para que el sitio, Leo (WhatsApp) y Ricardo cotizen **igual** y no se
prometa autonomía sin cobrar la IA.

---

## La regla en una frase

> Los precios de Boltech (US$600 la prueba, desde US$900 el agente) cubren
> **diseño, integración y entrega**. El **modelo de IA y su consumo no están
> incluidos**: se cotizan aparte o los paga el cliente directo al proveedor.

---

## Dos modos de operación (hay que elegir antes de cotizar)

| | **Modo A — con aprobación humana** | **Modo B — autónomo** |
|---|---|---|
| Quién decide | La persona aprueba cada acción sensible | El agente decide y ejecuta |
| Necesita IA de pago | **No** | **Sí, obligatorio** |
| Costo de IA | No aplica | Aparte: se cotiza o lo paga el cliente |
| Riesgo | Bajo: hay revisión | Alto: exige límites y monitoreo |
| Precio Boltech | Prueba US$600 / desde US$900 | Igual + línea de IA separada |

**Nunca** se cotiza el modo B con el mismo número que el modo A.

---

## Qué incluye y qué no

**Incluido en el precio de Boltech**
- Análisis del proceso y evaluación por escrito
- Diseño del flujo y de las aprobaciones
- Integración con una herramienta simple (correo, hoja, formulario, base de datos)
- Despliegue acompañado y capacitación
- Registro de acciones y pruebas de aceptación

**No incluido (se cotiza aparte)**
- Modelo de IA: consumo por token, licencias o suscripción del proveedor
  (OpenAI, Google, Anthropic u otro)
- Créditos de WhatsApp Business, SMS o correo transaccional
- Infraestructura extra (servidores, bases de datos de pago)
- Mantenimiento y monitoreo continuo
- Cambios de alcance posteriores a la aprobación

---

## Flujo para evitar errores

1. **Detectar.** Si el cliente dice *autonomía, sin aprobación, que decida solo,
   sin supervisión*, se activa la respuesta de autonomía (no la de precio).
2. **Preguntar.** *¿Necesita autonomía total o aprobación humana en las acciones
   sensibles?* Sin esta respuesta no se envía cotización.
3. **Separar.** La cotización lleva dos líneas:
   - Servicio Boltech (diseño, integración, entrega)
   - IA y consumo (cotizado aparte o pagado por el cliente al proveedor)
4. **Aprobar.** El cliente elige el modo y confirma por escrito.
5. **Registrar.** En Airtable, en `Notes`:
   `Modo: A (aprobación humana)` o `Modo: B (autónomo)` +
   `IA: incluida en cotización` / `IA: paga el cliente`.
6. **Entregar.** Antes de producción: límite de gasto por mes, registro de
   acciones y responsable de revisión.

---

## Frases aprobadas (usar tal cual)

**Español**
- “El precio cubre diseño, integración y entrega; no incluye el modelo de IA ni su consumo.”
- “La autonomía requiere un modelo de IA en operación: se cotiza aparte o lo paga el cliente directamente al proveedor.”
- “Si cada acción sensible lleva aprobación humana, no se requiere IA de pago.”

**English**
- “The price covers design, integration and delivery; it does not include the AI model or its usage.”
- “Autonomy needs an AI model running in production: it is quoted separately or paid by the client directly to the provider.”
- “If every sensitive action keeps human approval, no paid AI is required.”

---

## Errores que esto evita

| Error | Cómo lo evita |
|---|---|
| Cotizar autonomía al mismo precio que un flujo con aprobación | El modo se pregunta y se separa antes de cotizar |
| Prometer “sin costo de IA” | La respuesta de precio lo aclara siempre |
| Cliente sorprendido por la factura del proveedor | Se dice desde el primer mensaje quién paga la IA |
| Agente autónomo sin control de gasto | Se exige límite mensual y registro de acciones |
| Cotización verbal contradictoria | Las frases aprobadas son las mismas en web, WhatsApp y correo |

---

## Dónde está implementado

- `functions/api/_leo.js` → respuestas de Leo (WhatsApp), intención `autonomy`.
- `functions/api/lead.js` → asesor del sitio, intención `autonomy`.
- Pruebas: `tests/whatsapp-function.test.mjs` y `tests/advisor-autonomy.test.mjs`.
- Cualquier cambio de precio debe editarse en los dos archivos y volver a pasar
  `node --test`.
