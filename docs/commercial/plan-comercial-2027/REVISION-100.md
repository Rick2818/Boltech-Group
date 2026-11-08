# Revisión de contenido y evidencia — 2026-11-05

Revisión del plan comercial tipo Relevance AI antes de cualquier publicación.
Resultado global: **APTO EN LOCAL**, **NO APTO PARA PUBLICAR** hasta completar los puntos 3 y 4.
Actualizado el 2026-11-05 tras el cierre del plan: ver `docs/CIERRE-PLAN-COMERCIAL.md`.

## 1. Verificaciones ejecutadas

| Verificación | Comando | Resultado |
|---|---|---|
| Sintaxis de módulos | `npm run check` | OK |
| Pruebas automatizadas | `npm test` | 52 tests, 52 pass, 0 fail |
| Validación del embudo | `node src/cli.mjs funnel-check` | `status: VALID` |
| Validación SEO | `node src/cli.mjs seo-check` | `status: VALID`, 34 URLs |
| Landing generada | `preview/index.html` y `preview/en/index.html` | 75 archivos bilingües |

## 2. Estructura clonada (verificada)

- Capas del embudo (8): entrada, departamento, tarea, prueba, alternativa, conversión, confianza, activación.
- Bloques de tarea (8): promise, howItWorks, qualityBar, shapedBy, risk, sharedStack, expansion, cta.
- Campos del formulario (6): firstname, lastname, email, company, jobtitle, outcome.
- Idiomas: `es` y `en` con las mismas rutas.
- Páginas: 17 por idioma, 34 URLs en sitemap.

## 3. Reglas comerciales (verificadas)

- Presupuesto, teléfono, tamaño de empresa y plazo **no se piden en el formulario**: se descubren en la llamada.
- Las tres ofertas tienen `reference: true` y `quoteRequired: true`.
- Nota visible: "Precios de referencia, no ofertas finales. Contratación sujeta a cotización aprobada, impuestos y condiciones."
- No se encontraron declaraciones prohibidas en la configuración: sin porcentajes de resultado, sin "el mejor", sin garantías, sin testimonios inventados.

## 4. Evidencia

| Origen | Manifiestos | Estado |
|---|---|---|
| Langflow | 7 | `IMPORTED_PENDING_HUMAN_REVIEW` |
| Relevance AI | 8 | `IMPORTED_PENDING_HUMAN_REVIEW` |

Total: **15 manifiestos**. Ninguno está certificado. El benchmark documenta solo señales
comerciales observables y declara explícitamente que no mide ingresos, ARR, clientes ni churn.

## 5. Riesgos y límites declarados

- El texto de las páginas observadas quedó filtrado por la política de REA; no hay captura
  certificada.
- La landing no está publicada: `published: false`.
- No hay formulario conectado, analítica, CRM ni campañas.
- No se envían mensajes ni se generan gastos desde el proyecto.

## 6. Pendiente para publicar (requiere decisión del propietario)

1. Dominio y hosting aprobados.
2. Conector de formulario aprobado y recibo de extremo a extremo.
3. Analítica y medición de conversión.
4. Revisión humana de los 15 manifiestos de evidencia.
5. Aprobación de copy y límites comerciales (y legal si aplica).

Sin esos cinco puntos, el estado correcto es `REVIEW_REQUIRED`. No se declara certificación.
