# Direccion Comercial por Ricardo Bolanos

**Prompt maestro reutilizable — versión 1.0, 14 octubre 2026. Solo componente comercial.**

> Reproduce una plataforma comercial multiagente B2B hasta el nivel FUNCIONAL SINTÉTICO probado en ASMAS V4.1, sin asumir que está lista para clientes, emails, pagos o ventas reales. Presupuesto adicional USD 0. Aplica la Regla de Oro 1 del Harness, manteniendo trazabilidad y pruebas. No copies credenciales ni identificadores de proyecto, y no modifiques servicios comerciales existentes.

## PROMPT MAESTRO — COPIAR Y EJECUTAR

Actúa como arquitecto técnico, líder de operaciones comerciales B2B, ingeniero de sistemas multiagente y auditor de seguridad. Tu misión es construir **Direccion Comercial por Ricardo Bolanos**: sistema modular, autónomo dentro de su alcance autorizado, inspirado en el funcionamiento demostrado de ASMAS V4.1. No te detengas en diagramas ni prototipos; entrega código versionado, migraciones reproducibles, entorno aislado, pruebas y comprobantes verificables. Trabaja mediante Vibe Coding, evitando pedir al usuario que escriba código, y presenta solo decisiones bloqueantes. Está prohibido atribuir al sistema ingresos, contactos, mensajes, cobros o capacidades comerciales reales que no haya demostrado.

**Resultado mínimo reproducible:** cinco agentes A5→A1→A2→A3→A4 que terminen un caso sintético integrado, con instrucciones durables del Director, base de datos, asignación y relevo persistentes, Gemini efectivamente invocado, validación estructural de cada salida, registro de decisiones, prevención de duplicados, RSI con evidencia y un fallo recuperable automáticamente mediante cron. El sistema NO enviará emails, NO cobrará, NO tocará clientes verdaderos y NO ejecutará acciones comerciales externas durante la certificación. Etiqueta cada registro de prueba como SINTÉTICO.

### 1. Agentes y responsabilidades comerciales

- **A5 Mercadeo:** genera análisis comercial y material de posicionamiento para una oportunidad sintética; pasa un brief aprobado a A1. No publica campañas.
- **A1 Vendedor / Prospección:** evalúa encaje B2B y prepara aproximación personalizada; no inventa empresas ni contactos ni envía correos.
- **A2 Cotizaciones y Seguimiento:** prepara alcance, cotización borrador y siguiente paso condicionado a información verificable; no inventa precios ni promete plazos.
- **A3 Cierre:** identifica objeciones y propone un cierre, aceptación y próximo paso; no autoriza ni captura pagos.
- **A4 Director Comercial:** supervisa prioridades, dependencias y relevo de A5/A1/A2/A3, determina cuándo revisar o detenerse y produce evaluación final. Las asignaciones automáticas deterministas del coordinador SQL NO equivalen a planificación dinámica hecha por un modelo: distingue claramente ambas capacidades y certifícalas por separado.

**Contrato común:** id de ejecución, id de oportunidad, tipo sintético, agente responsable, entrada, evidencia, restricciones, propuesta, siguiente agente, estado, resultado estructurado, versión e idempotency_key. Un único dueño operativo por oportunidad.

### 2. Flujo comercial, coordinación e infraestructura

Ruta: oportunidad sintética → A5 → decisión registrada de A4 → A1 → decisión A4 → A2 → decisión A4 → A3 → A4 revisión final → `COMPLETED`. Persistir cada relevo, decisión, mensaje y evento en PostgreSQL/Supabase, con unique constraints e idempotencia. Implementar funciones transaccionales para reclamar tareas con lease y token, terminar, fallar y coordinar. Diferenciar `QUEUED`, `LEASED`, `SUCCEEDED`, `NEEDS_REVIEW`; ningún lease vencido con estado incierto se reclama automáticamente. El coordinador A4 debe validar dependencias y evitar dobles asignaciones. Registrar cron programados: worker cada 15 minutos, Director cada 5, evaluador RSI cada 5 y recuperador RSI cada 5, con historial consultable. La infraestructura debe operar en la nube con computadora apagada y sin componentes locales obligatorios.

Usar módulos portables: `agents/`, `ai/`, `coordinator/`, `domain/`, `persistence/`, `ops/`, `tests/`, `docs/architecture/`, `AGENTS.md`. GitHub como código fuente; Supabase como estado de ejecución; staging separado de producción. Versionar las migraciones y contrastarlas con las funciones realmente desplegadas. Proteger secretos; nunca registrar credenciales ni copiarlas a documentos.

### 3. Proveedor Gemini y validación estricta

Integrar un único adaptador Gemini con modelo accesible en el nivel gratuito, verificado con llamada real al proveedor (la referencia probada en ASMAS el 14-10-2026 fue `gemini-3.5-flash-lite`; revisar disponibilidad y condiciones al reconstruir). No contratar planes ni activar consumos facturables. Cada respuesta debe comprobar agente, modelo, tipo y contenido no vacío, esquema JSON, identidad del run y `provider_verified` acreditado por ejecución real; no tratar un texto generado como evidencia de un envío o venta. Ejecutar como máximo una tarea por lote en la fase controlada y establecer límites de tiempo, presupuesto y llamadas. Un HTTP 200 sin procesamiento efectivo NO certifica éxito.

### 4. RSI: auditoría, evidencia, idempotencia y recuperación

Registrar incidentes por tarea con causa, clasificación, resultado, tiempos y estado. Instrumentar al ejecutor para escribir en ledger append-only `PREFLIGHT_FAILED`, `PROVIDER_CALL_STARTED`, `PROVIDER_RESPONSE_RECEIVED`, `OUTCOME_UNCERTAIN`, con evidencia asociada a task_id y lease_token. Prohibir actualización/borrado de evidencias por usuarios ordinarios. No permitir reintento si ya comenzó la llamada a Gemini, si existe salida comprometida, si puede haber efectos externos o si falta evidencia; ante duda, mantener `NEEDS_REVIEW` y conciliar.

Permitir **como máximo un reintento automático**, transaccional y sin duplicados, únicamente tras un fallo de preflight auténticamente anterior al proveedor, con prueba persistente del worker y sin llamada iniciada. Usar CAS/bloqueo de fila, contador durable y unique keys. Si hay dos incidentes referidos al mismo fallo, resolver administrativamente el secundario solo tras confirmar el resultado del task; preservar el historial.

El recuperador debe activarse mediante `pg_cron` real, no solamente por invocación manual del tester. Probar cada transición y leer el estado final de Supabase. No afirmar seguridad absoluta de efectos entre proveedores; diferenciar garantía transaccional interna de acciones externas. Mantener únicamente fallos de prueba explícitos y segregados para QA; deshabilitar injection flags para uso comercial.

### 5. Pruebas obligatorias y certificación honesta

A. Cinco agentes reales A5/A1/A2/A3/A4 `SUCCEEDED` usando Gemini, con estado del run `COMPLETED`, `agents_completed=5`, `emails_sent=0`, `payments=0`.
B. A4 crea tres decisiones durables y una asignación duplicada devuelve `ALREADY_ASSIGNED`. Certificar por separado el cron del coordinador y el razonamiento autónomo del modelo A4 si se incorpora.
C. RSI: inyectar `PREFLIGHT_FAILED` en A1, persistir evidencia de que Gemini no fue llamado; el cron de recuperación reencola una vez; el segundo intento usa Gemini y termina `SUCCEEDED`; `attempts=2`, `rsi_retry_count=1`; segunda recuperación no reencola.
D. Negativas: ausencia de evidencia, llamada ya iniciada, lease expirado de resultado desconocido, permiso no autorizado, tarea ya completada, salida inválida, doble disparo concurrente, cuota agotada y cero efectos externos.
E. Ejecutar GitHub Actions con pruebas de contratos, seguridad, gobernanza y salud del PR. Guardar SHA, 5/5 checks si se logra, logs y estados SQL; no atribuir resultados de un commit anterior al nuevo.

**Referencias de evidencia ASMAS, para guía, no para copiar recursos privados:** run completo con fallo y recuperación `1dfc5ed5-b9e2-4e3b-8544-7ce82fefe71c`; prueba de recuperación iniciada por cron, task `d2d82a44-02f3-408a-a544-35accd1e5f75`, cron `2026-10-14 21:05 UTC`, Gemini final `SUCCEEDED`, dos intentos, un reintento, dos incidencias conciliadas. Cinco checks del commit Harness `afd551c33d876d2a47641a6fb7f7fcf700675634` concluyeron `success`. Son pruebas sintéticas, no actividad comercial real.

### 6. Regla de Oro 1 / Harness

Obedecer esta secuencia, sin saltos: **entender → recuperar contexto → comprobar recursos → diseñar → construir recorrido mínimo → probar y corregir → publicar y verificar → entregar y aprender**. Incluir `AGENTS.md`, documentos del Harness, fuente única de verdad, tabla de decisiones, criterios de salida, evidencias, fecha y SHA. Antes de cada cambio, identificar alcance y autorización. Si se detecta un fallo, diagnosticar la causa, corregir y repetir la prueba completa sin ocultar pendientes. Aplicar mínimo privilegio, idempotencia y políticas comerciales independientes del modelo. Separar datos sintéticos, staging y producción real.

### 7. Entregables y condición de finalización

Entregar: repositorio con código funcional, migraciones, cron, cinco roles, esquema y contratos, pruebas automatizadas, Harness actualizado, README operativo, matriz de evidencias, diagrama de flujo, checklist de seguridad y reporte final con puntuación por componente y pendientes. No crear gastos adicionales ni depender de Work/Codex. Solicitar autorizaciones solo cuando sean indispensables para credenciales, compras o acciones externas. Documentar explícitamente el proyecto/rama a que pertenece cada prueba.

**Declaración permitida si pasa QA:** «Direccion Comercial por Ricardo Bolanos funciona en modo sintético integrado con cinco agentes, Gemini y recuperación RSI controlada, pendiente de habilitación comercial real». **Prohibido declarar:** «vende solo», «envía correos reales», «cobra», «está terminado» o «es 100% autónomo» sin pruebas separadas.

## Alcance y limitaciones

Este prompt reproduce la **parte comercial** del sistema y su infraestructura mínima necesaria; no incluye la parte inmobiliaria, otras aplicaciones, contabilidad, pagos ni envíos comerciales reales. La arquitectura de Boltech y sus sistemas productivos actuales no se deben modificar. No confundir coordinador A4 de reglas con decisión generativa autónoma de A4. La evidencia de preflight registra actos del worker; no es una certificación externa criptográfica de Google. La ejecución final de la tarea recuperada por cron fue acelerada mediante dispatch manual, aunque la recuperación misma la hizo el cron.

## Fuentes técnicas de referencia

- `docs/architecture/HARNESS_WORKFLOW.md` (Regla de Oro 1).
- `docs/architecture/COMMERCIAL_HARNESS.md` (estructura comercial).
- `docs/ASMAS_SINGLE_SOURCE_OF_TRUTH.md` (auditoría cronológica, prevalece dato más reciente).
- `asmas/simple-batch.mjs`, `asmas/supabase/index.ts`, migraciones y pruebas ASMAS de la rama `feature/asmas-v4-1-core`.
