# Benchmark comercial observable — Langflow y Relevance AI

Fecha de observación: 2026-11-03. Método: REA 6.8.0 sobre Chrome 156.0.8078.80 con CDP en loopback,
solo páginas públicas, sin sesión ni autenticación.

## 1. Qué mide este documento y qué no

Mide **señales comerciales observables**: cómo se posicionan, a quién le hablan, qué CTA ofrecen,
qué prueba social publican, si publican precios y cómo segmentan.

**No mide** ingresos, ARR, número de clientes, churn ni cuota de mercado. Esos datos no existen en
ninguna de las páginas observadas. Cualquier cifra de negocio atribuida a estas empresas sería
inventada y queda fuera de este análisis.

Las cifras que sí aparecen (por ejemplo 7 M USD de pipeline) son **declaraciones del vendedor en su
propia web**, no métricas auditadas. Se citan como tales.

## 2. Evidencia utilizada

Todas registradas con `stageReaEvidence`, estado `IMPORTED_PENDING_HUMAN_REVIEW`, artefactos locales
disponibles en `.clonador/` y `.clonador/bench/`.

| Evidencia | Página | Qué aporta |
|---|---|---|
| `ev_9f03a7bd…f74` | `https://www.langflow.org/` | Landing: propuesta, CTAs, métricas exhibidas |
| `ev_c59595f6…f86d` | `https://www.langflow.org/pricing` | **404**: no hay página pública de precios en esa ruta |
| `ev_0eb1c375…f78` | `https://www.langflow.org/use-cases/` | Catálogo de plantillas y categorías |
| `ev_013615ff…b62` | `https://relevanceai.com/` | Landing: posicionamiento enterprise y casos de cliente |
| `ev_2305adaf…7ef` | `https://relevanceai.com/pricing` | Precios sin cifras: Enterprise, Talk to sales, Custom Vendor Credits |

## 3. Lo que se observó

### Langflow — plataforma para construir

- Propuesta: *Low-code AI builder for agentic and RAG applications*.
- CTAs de la landing: **Get Started for Free** y **Star on GitHub**. El segundo es una señal de
  estrategia open source: la comunidad es parte del embudo.
- Métricas exhibidas sin unidad ni fuente: 156k, 25k, 10k, 16k.
- Secciones: *Drag. Drop. Deploy* · *Run, Share and Collaborate* · *Flow as an API* ·
  *Agents at your service* · *Limitless Control*.
- Casos de uso organizados como **catálogo de plantillas**, no como relatos de cliente:
  Call Classification Analytics, CSV Query Assistant, PRD Draftsman, Bug Report Deduplicator,
  Feature Prioritization Scorer, AI Contract Risk Scanner, Content Cascade Flow, Data Extraction.
  Categorías: Business, Customer Support, Documents, Knowledge Bases, Analytics, Data Processing.
- **No hay página pública de precios** en `/pricing` (404 observado).

Lectura: entra por abajo. El usuario llega, ve un componente que reconoce, lo prueba gratis y
construye. La prueba social es la comunidad, no el caso de negocio.

### Relevance AI — fuerza de trabajo para vender

- Propuesta: *Specialist AI Agents for Every Task* y *The home of the AI Workforce*.
- Mensajes de nivel directivo: *Drive ROI in just weeks* · *Unlock the agentic ROI you promised your
  board* · *Built for enterprise teams* · *Security & data privacy* · *Access & controls*.
- Prueba social con cifras declaradas por el vendedor: Qualified generó 7 M USD de pipeline con
  35+ agentes; Send Payments ahorra 40 horas semanales; Zembl +30 % de conversiones; caso de Autodesk.
- Segmentación **por departamento**, no por tecnología: Sales, Customer Success, Marketing,
  Customer Support, Operations, Human Resources, Research, Product.
- Tiene **página de competidores**: Clay, Claude Managed Agents, OpenAI Codex, Gemini Enterprise,
  Microsoft Copilot Studio, Gumloop, Dust.
- Precios publicados sin cifras: Enterprise, Talk to sales, Custom Vendor Credits.
- Infraestructura de confianza: Trust Center, whitepapers y datasheets, Academy, Expert Partner
  Directory, API & MCP.

Lectura: entra por arriba. Le habla al que firma el presupuesto, no al que escribe el código, y
convierte con una demo asistida, no con un registro autoservicio.

## 4. Comparación

| Dimensión | Langflow | Relevance AI |
|---|---|---|
| Comprador implícito | Desarrollador / equipo técnico | Directivo de área (ventas, soporte, operaciones) |
| Unidad de valor | El flujo y el componente | El agente que hace un trabajo y su ROI |
| Entrada al embudo | Registro gratuito + GitHub | Demo con ventas |
| Precio público | No (404 en `/pricing`) | Página existe, sin cifras |
| Prueba social | Comunidad y plantillas | Casos con cifras y logos |
| Segmentación | Por plantilla y categoría técnica | Por departamento |
| Competencia | Implícita | Explícita, con páginas comparativas |
| Fricción de entrada | Baja | Alta, deliberada |

No hay un ganador absoluto: son **dos embudos distintos para dos compradores distintos**.

## 5. Lo mejor de cada una

De Langflow:

1. **Plantillas con nombre de tarea concreta.** "Bug Report Deduplicator" se entiende sin explicación.
2. **Entrada de fricción casi nula.** Probar gratis y ver el resultado antes de hablar con nadie.
3. **El flujo como API como argumento de reutilización**, no solo como característica.
4. **La comunidad como prueba social**, en lugar de fabricar testimonios.

De Relevance AI:

1. **Lenguaje de resultado de negocio**, no de tecnología.
2. **Casos con cifras y nombre propio**, con la fuente a la vista.
3. **Segmentación por departamento**, que permite landing distinta por comprador.
4. **Página de competidores explícita**, que captura búsquedas de comparación.
5. **Trust Center y datasheets**, que reducen el riesgo percibido de compra.

## 6. Fusión propuesta para Clonador

Ninguna de estas piezas copia texto, diseño ni código ajeno: son decisiones de producto.

| # | Pieza | De dónde viene | Módulo | Criterio de aceptación |
|---|---|---|---|---|
| 1 | Fichas de caso de uso con nombre de tarea concreta, no de tecnología | Langflow | `src/commercial.mjs` | Cada ficha tiene tarea, entrada, salida y quién revisa |
| 2 | Entrada de bajo roce: evaluación de alcance sin precio y sin demo obligatoria | Langflow | `src/offer.mjs` | `priceStatus` sigue en `PENDING_OWNER_DECISION` |
| 3 | Mensaje por departamento del comprador | Relevance | `config/commercial-playbooks.json` | Un rol → un problema → un CTA, sin promesas de resultado |
| 4 | Casos con cifras solo si son propias y verificadas | Relevance | `src/metrics.mjs` | Cifra sin registro persistido ⇒ se declara no disponible |
| 5 | Página de comparación honesta | Relevance | `src/content.mjs` | Cada afirmación con `sourceIds`; sin "el mejor" ni garantías |
| 6 | Ficha de confianza: qué se hace con los datos y qué no | Relevance | `docs/` + `src/content.mjs` | Enumera límites reales, no promesas |

Las reglas 4 y 5 ya están parcialmente cubiertas: `content.mjs` prohíbe porcentajes, importes y
"el mejor del mercado" en materiales propios, y `metrics.mjs` solo calcula desde registros
persistidos. La fusión consiste en **extender esas guardas**, no en relajarlas.

## 7. Lo que este benchmark no autoriza a decir

- Que Langflow o Relevance AI tengan más o menos clientes o ingresos.
- Que sus cifras publicadas sean auditadas.
- Que exista un ganador del mercado.
- Que Clonador haya certificado nada: los manifiestos siguen en
  `IMPORTED_PENDING_HUMAN_REVIEW`.
