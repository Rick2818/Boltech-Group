# Procedimiento general del harness

Instrucción de Ricardo, 12 octubre 2026. Aplicable al desarrollo, corrección y entrega de cualquier app. Objetivo: reducir retrabajo y obtener un resultado funcional en la primera entrega validada. No significa garantizar ausencia absoluta de fallos ni saltar pruebas.

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
