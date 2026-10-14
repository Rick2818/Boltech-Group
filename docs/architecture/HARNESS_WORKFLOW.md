# Regla de Oro 1 — Procedimiento lógico del harness

Instrucción de Ricardo, 12 octubre 2026. Primera regla general del harness, aplicable al desarrollo, corrección y entrega de cualquier app, dentro de las instrucciones de mayor prioridad y el alcance autorizado. Objetivo: reducir retrabajo y obtener un resultado funcional en la primera entrega validada. No significa garantizar ausencia absoluta de fallos ni saltar pruebas.

## Una guía amigable y una IA con responsabilidad

El harness usa la IA del asistente para comprender, razonar, planificar, implementar, revisar y explicar. Las reglas y fuentes limitan sus decisiones. AGENTS.md es el punto de entrada; este procedimiento explica el orden; el plan conserva lo hecho y pendiente; un registro de decisiones conserva cambios nuevos. El usuario recibe el resultado y solo las preguntas que realmente desbloquean la tarea, con lenguaje claro y sin carga técnica innecesaria.

No crear un agente adicional ni un modelo facturable solo para tener un harness. La IA de una aplicación, cuando se solicite, usa un módulo central con modelo verificado, salida estructurada, herramientas permitidas y límites de presupuesto. Su configuración y una llamada real autorizada se verifican antes de declararla integrada.

## Secuencia obligatoria

| Paso | Qué hace el harness | Cómo sabe que terminó |
|---|---|---|
| 1. Entender | Identifica usuario, problema, resultado, alcance y restricciones | Criterio concreto de éxito y datos faltantes críticos identificados |
| 2. Recuperar | Lee instrucciones, decisiones, código y estado real | Distingue hechos, hipótesis, historial y pendientes; no reinicia trabajo hecho |
| 3. Verificar recursos | Comprueba dependencias, herramientas, credenciales por su uso normal y límites | Lecturas reales pasan; capacidades ausentes quedan explícitas antes de ampliar la app |
| 4. Diseñar y decidir | Define arquitectura mínima, responsables, estados, contratos y límites de IA | Plan revisable con pruebas de aceptación; ninguna herramienta o rol duplicado |
| 5. Construir el recorrido | Implementa primero una entrada y un resultado completo con datos autorizados | Flujo mínimo integrado, trazable y recuperable, antes de ampliar funciones o interfaz |
| 6. Probar y corregir | Prueba caso feliz, límites, duplicados, permisos, salida de IA inválida y caída de terceros | Pruebas pertinentes pasan; un fallo significativo se corrige y se vuelve a verificar |
| 7. Publicar y verificar | Publica dentro del alcance autorizado; comprueba commit, estado, flujo y readback | El resultado servido en producción coincide con el probado; recibos verificados |
| 8. Entregar y aprender | Reporta resultado, evidencia y límites; registra decisiones y problemas nuevos | El usuario sabe qué funciona y qué falta; las lecciones quedan accesibles al siguiente trabajo |

## Decisión cuando falta documentación

Contrastar la acción con el objetivo, las instrucciones del usuario, las políticas y la evidencia. Si es reversible y está dentro del alcance autorizado, resolverla, registrar el motivo y continuar. Si necesita información crítica, pedir solo esa información y avanzar lo independiente. Si introduce gasto, obligación o acción externa fuera del permiso vigente, preparar primero el resultado concreto y pedir la autorización específica. No repetir preguntas ya respondidas ni confundir silencio con aprobación.

Registro mínimo: fecha, problema, decisión, responsable, motivo, evidencia, alcance, prueba y resultado. Las instrucciones explícitas del usuario prevalecen sobre la plantilla.

## Corrección de rumbo

Si la ejecución se aparta del objetivo o aparece una integración rota: nombrar el bloqueo, conservar el estado y sus evidencias, actualizar el plan, volver al último punto verificado y corregir la causa. Continuar tareas independientes; no esconder el error, inventar datos o ampliar el alcance para evitarlo. Una respuesta incierta de un envío o cobro se concilia antes de repetir.

## Qué cuenta como resultado funcional

El caso acordado termina de punta a punta, con herramientas necesarias conectadas, decisiones autorizadas, estado persistente, fallos manejados y comprobantes consultables. Una instalación, un mock, un material preparado o un despliegue READY por sí solos no cumplen ese criterio. Para agentes comerciales de Boltech se añade el protocolo de REGLA-DE-ORO.md, incluida la semana supervisada. Datos de prueba y actividad comercial real se mantienen distinguibles.

## Reutilización

Al iniciar otra app, copiar este procedimiento y un AGENTS.md que lo referencie al nuevo repositorio. Adaptar criterios de éxito, conectores, permisos y roles al caso real; conservar principios, pruebas y lecciones. No asumir que la documentación de este workspace se transfiere automáticamente a otra cuenta o entorno.


## Caso verificado: ASMAS — autonomía y recuperación RSI (14 octubre 2026)

**Declaración autorizada de estado:** ASMAS V4.1 **funciona en modo sintético controlado**, aunque **no está terminado ni certificado para venta comercial**. No convertir este resultado en afirmaciones de correos enviados, cobros o ventas reales.

**Evidencia reproducible:**
- Recorrido anterior con cinco agentes y Gemini: ejecución `1dfc5ed5-b9e2-4e3b-8544-7ce82fefe71c`, `COMPLETED`, agentes A5/A1/A2/A3/A4 `SUCCEEDED`, cero correos y cero pagos. A1 falló en preflight de prueba, fue autorizado una vez por RSI y completó en el segundo intento.
- Orquestación real de A4: trabajo programado `asmas-director-5m`, órdenes persistentes en `asmas.director_decisions`, con comprobaciones de duplicados y dependencias. Coordinación programada verificada.
- **Prueba específica de recuperación iniciada por cron:** tarea sintética `d2d82a44-02f3-408a-a544-35accd1e5f75`, inicialmente `NEEDS_REVIEW` con `PREFLIGHT_FAILED`. Sin invocar manualmente la función RSI, el cron `asmas-director-recover-5m` ejecutó a las `2026-10-14 21:05:00 UTC` y terminó `succeeded`. Lectura posterior a las `21:05:33 UTC`: tarea `QUEUED`, `rsi_retry_count=1`, incidencia de preflight `RESOLVED`, `retry_authorized=true`.
- **Limitación concreta detectada:** la misma tarea mantiene otra incidencia `TASK_NEEDS_REVIEW` todavía abierta; se debe conciliar/cerrar esa incidencia derivada sin borrar evidencia. Esta prueba acredita **reencolado por cron**, no ejecución final de Gemini de esa tarea. Comprobar después su resultado y que no existan nuevos reintentos.
- Los trabajos programados (batch de 15 min, A4 de 5 min, clasificación RSI de 5 min, recuperación RSI de 5 min) operan en el proyecto ASMAS aislado. Boltech `main` y el flujo comercial no se modifican por esta certificación.

**Aplicación del Harness (Regla de Oro 1):** definir el criterio de éxito, extraer evidencia SQL real, inyectar solo fallos sintéticos explícitos, comprobar cron sin llamadas directas a la función, validar idempotencia, reconciliar incidencias duplicadas, comprobar el resultado posterior y documentar exactamente los límites. Nunca anunciar autonomía comercial basada únicamente en pruebas sintéticas.

**Próxima aceptación:** cerrar incidencias administrativas residuales, confirmar procesamiento posterior del caso de cron y correr pruebas CI contra el mismo commit; mantener permisos y límites de costo vigentes.


### Cierre de evidencia RSI / Harness — 14 octubre 2026

**Resultado verificado:** ASMAS es funcional para su caso de prueba sintético controlado. La tarea `d2d82a44-02f3-408a-a544-35accd1e5f75` fue reencolada por el cron `asmas-director-recover-5m` a las `2026-10-14 21:05 UTC` y posteriormente procesada mediante el ejecutor real de Gemini.

**Comprobaciones en Supabase:**
- Tarea A1: `status=SUCCEEDED`, `attempts=2`, `model=gemini-3.5-flash-lite`, `provider_verified=true`, `rsi_retry_count=1`.
- Incidencia `PREFLIGHT_FAILED`: `RESOLVED`, un único reintento autorizado con decisión `AUTHORIZED_LEDGER_PREFLIGHT_ONLY`.
- Incidencia administrativa adicional `TASK_NEEDS_REVIEW`: conciliada y marcada `RESOLVED` exclusivamente después de comprobar el resultado persistido; decisión `RECONCILED_TASK_SUCCEEDED`, `retry_authorized=false`. El historial permanece disponible.
- El flujo de recuperación se disparó por cron sin invocar manualmente `director_rsi_auto_recover()` para esa tarea. La ejecución posterior de Gemini se solicitó mediante `asmas.simple_dispatch()` durante la comprobación, de modo que no se acredita un ciclo de ejecución completamente desatendido de principio a fin para esa tarea.

**Pruebas automáticas:** commit del Harness `afd551c33d876d2a47641a6fb7f7fcf700675634`: cinco comprobaciones `success` — ASMAS full contract checks, ASMAS V4.1 synthetic core, Boltech Governance Validation, Followup Safety y Production health. No confundir estas pruebas con certificación de flujos comerciales reales.

**Decisión del Harness:** comunicar «ASMAS funciona en modo sintético; está en desarrollo». Pendientes separados: pruebas comerciales reales con autorizaciones explícitas y validación de ejecución comercial extremo a extremo. No modificar Boltech `main` ni habilitar cobros o correos de venta por inferencia.
