# Estructura comercial de referencia y guía del harness

**Estado automático de pruebas y Vercel:** [registro vivo #86](https://github.com/Rick2818/Boltech-Group/issues/86). [Funcionamiento y límites](HARNESS_AUTODOC.md). Los resultados operativos cambian automáticamente en el registro; esta guía versionada no se reescribe sola.

Instrucción de Ricardo, 12 octubre 2026. Objetivo: reutilizar una base probada para que la próxima aplicación no repita los fallos de integración, coordinación y verificación de Boltech. Este documento define una estructura; no acredita que una aplicación futura, sus modelos o sus conectores estén implementados.

## Mapa del sistema

Ricardo establece oferta, presupuesto y excepciones. Directora prioriza oportunidades y valida decisiones dentro de esas reglas. RSI-01 investiga y obtiene respuesta; RSI-02 diagnostica y define criterios; RSI-03 presenta el alcance aprobado y conduce aceptación y cobro. Mercadeo apoya una necesidad concreta de esos responsables. La entrega se valida técnicamente antes de ser acreditada. El harness orienta la implementación y conserva las decisiones del proyecto; no es otro emisor comercial ni reemplaza al coordinador de producción.

Entrada → registro único en CRM → RSI-01 → respuesta humana verificada → RSI-02 → diagnóstico y viabilidad → aprobación individual de Dirección → RSI-03 → aceptación explícita → enlace de pago → pago confirmado por proveedor → entrega validada → aviso comprobado a Ricardo.

El registro incluye opportunityId, responsable, etapa, evidencia, autorización aplicable, próxima acción y fecha. Todo evento mantiene eventId, origen, destino, versión, resultado y comprobante. Un estado desconocido conserva UNKNOWN hasta conciliar; nunca dispara un reenvío ciego. Se usan deduplicación, actualizaciones con versión y reservas antes de acciones externas. No se promete exactly-once entre proveedores independientes.

## Decisores y límites

| Responsable | Decide | Evidencia necesaria |
|---|---|---|
| Ricardo | Presupuesto, cambios de oferta, precio y excepciones | Resultado concreto para revisión y alcance de la autorización |
| Directora | Prioridad, responsable, avance dentro de condiciones autorizadas | Estado CRM, fuente vigente y evidencia del cliente |
| RSI-01 | Encaje inicial y siguiente contacto permitido | Investigación, historial vigente, canal y permiso; bloqueo por baja o rebote |
| RSI-02 | Datos faltantes, diagnóstico y prueba del caso | Respuesta real, proceso, herramientas, permiso sobre datos y criterio medible |
| RSI-03 | Siguiente paso de un cierre aprobado | Alcance firmado, costos documentados, aceptación en el hilo y pago proveedor |
| Mercadeo | Material que desbloquea una etapa | Solicitud específica, cuenta, etapa, necesidad y entregable; uso verificado por separado |
| Harness | Ruta técnica, comprobaciones y coherencia documental | Instrucciones, plan vigente, contratos y pruebas; no inventa aprobación comercial |

## IA integrada con controles

Un único módulo de modelos, configuración por rol y salida estructurada. El proveedor y modelo se verifican al configurar; no se seleccionan por memoria ni se reparten claves entre agentes. La IA puede interpretar necesidad, resumir evidencia, redactar y proponer prioridad. La validación de herramientas, autorización, precios, estados y pagos permanece en código. La salida incluye evidencia utilizada, datos faltantes y acción propuesta. Un esquema inválido o falta de evidencia devuelve el caso a revisión; el texto del modelo nunca es un comprobante de envío, aceptación o pago.

Permitir únicamente herramientas del rol y cuenta actual. El contenido del cliente se trata como datos, no como instrucciones para cambiar permisos. Establecer límite de pasos, tiempo, tokens, costo y alternativas. No crear bucles ilimitados. Un fallo de modelo o conector deja un pendiente visible y permite continuar trabajo independiente. Con presupuesto USD0 vigente no se activa consumo facturable; diseñar la integración no autoriza gasto.

## Base técnica portable

```text
app/
  AGENTS.md                    # Reglas que lee el harness
  docs/architecture/           # Mapa, decisiones y contratos
  domain/                      # Estados, oferta y políticas
  agents/                      # Roles y salidas estructuradas
  coordinator/                 # Asignación, relevos y autorización
  ai/                          # Proveedor, modelos, límites y esquemas
  adapters/                    # CRM, correo, pagos y entrega
  persistence/                 # Eventos, oportunidades, outbox y recibos
  api/                         # Entradas autenticadas y webhooks
  ops/                         # Readiness, conciliación y monitor
  tests/                       # Contratos y recorrido completo
```

Una fuente durable de verdad para estado y eventos. El CRM operativo puede ser una vista o adaptador; no debe competir con otro ledger sin reglas de conciliación. Las acciones pendientes y sus recibos sobreviven al reinicio. Un proceso local no se declara servicio cloud continuo. Credenciales por entorno y mínimo acceso. Preflight debe verificar lecturas reales de conectores, persistencia, configuración del modelo y presupuesto antes de habilitar cada capacidad.

## Puerta de salida a producción

1. Acordar el problema, herramientas, permisos, resultado medible y límites con el cliente.
2. Probar conectores reales antes de ampliar agentes o interfaz; diferenciar lectura, escritura y envío.
3. Completar un recorrido integrado con el caso QA autorizado y proveedores aislados; incluir duplicados, campos faltantes, salida de IA inválida, instrucciones adversas, timeout, caída de API y recuperación tras reinicio.
4. Publicar solo código probado; las verificaciones esperan el commit exacto que sirve producción. READY acredita despliegue, no operación comercial completa.
5. Hacer readback de toda modificación, comprobar recibos y verificar una interacción productiva autorizada sin atribuir las pruebas a ingresos.
6. Cumplir la semana supervisada del protocolo de Ricardo antes de automatizar por completo o declarar entrega.

La preparación inicial no puede garantizar que terceros nunca fallen. La meta verificable es que el caso acordado funcione, el sistema detecte fallos, no duplique acciones y retome el trabajo con evidencia.

## Cómo el harness devuelve el proyecto al camino

Al iniciar: leer AGENTS.md, la Regla de Oro y este documento; recuperar el estado real, instrucciones del usuario y pendientes. Antes de cambiar: comprobar objetivo, responsable, etapa, autorización y prueba necesaria. Ante una desviación: identificarla, volver al último estado verificado, corregir el plan y ejecutar la solución dentro del alcance autorizado. Al terminar: registrar qué cambió, por qué, cómo se verificó y qué queda pendiente.

Para una decisión nueva, registrar: fecha, decisión, responsable, motivo, alcance, evidencia, alternativa descartada y criterio de aceptación. Un cambio rutinario y reversible dentro del alcance se puede resolver y documentar sin pedir permiso otra vez. Una nueva obligación comercial, gasto o acción externa fuera de lo autorizado requiere aprobación sobre un resultado concreto. Las instrucciones explícitas de Ricardo prevalecen sobre este esquema.

Fallos observados en Boltech que esta base debe impedir: dependencias no instaladas; errores originales ocultos; un material que bloquea otros roles; preparación genérica sin necesidad específica; atribución de correos viejos a material nuevo; ciclos contra el despliegue anterior; respuesta de mantenimiento no verificable; confusión entre ejecución técnica y venta. Cada corrección necesita una prueba del fallo real y evidencia posterior a la publicación.


## Extensión de certificación de entregas (2026-10-15)

Aplicar también [`docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md`](docs/architecture/HARNESS_CLIENT_DELIVERY_CERTIFICATION_20261015.md) para los roles E1–E4, GitHub Actions, Vercel, recuperación RSI y pruebas de aceptación. `INFRA_PASS` no es certificación del cliente; no afirmar ejecutores productivos ni trabajo entregado sin recibos reales.


## Evidencia ASMAS A1→A2 (15 octubre 2026)

Consultar [`docs/audits/ASMAS_SYNTHETIC_MAIL_RELAY_CERTIFICATION_20261015.md`](docs/audits/ASMAS_SYNTHETIC_MAIL_RELAY_CERTIFICATION_20261015.md): PR #78, GitHub Actions #38765754748 (15/15 PASS), exclusión del Cliente Sintético y traspaso de comprador simulado condicionado a aprobación. Verificar despliegue Vercel separadamente; estas pruebas no acreditan OAuth ni ventas reales.


## Gmail OAuth productivo — 15 octubre 2026, 21:13 SV

[Verificación de conexión y recuperación](../audits/GMAIL_OAUTH_CONNECTION_VERIFICATION_20261015.md): renovación OAuth y perfil de `ricardo.boltechgroup@gmail.com` verificados contra producción; `CONNECTION_VERIFIED`, trabajo Actions [116791556010](https://github.com/Rick2818/Boltech-Group/actions/runs/37798177082/job/116791556010), 13 pruebas aprobadas. Se actualizaron las tres variables OAuth y se redesplegó. Esta prueba no envió correos ni acredita campaña, traspaso comercial, entrega o venta. El indicador observado fue `automatedCampaignEnabled=false`. Reutilizar el workflow existente para futuras verificaciones y conservar los secretos solo en sus almacenes autorizados.


## Cliente Sintético — prueba final Gmail y roles, 15 octubre 2026

[Recibo y límites](../audits/SYNTHETIC_GMAIL_ALL_AGENTS_20261015.md): correo real enviado y recibido en Gmail Boltech, messageId `1a142b8b416b2fc3`; 108 pruebas locales de RSI-01/02/03, Mercadeo, Dirección y entrega aprobadas con proveedores simulados; CI de entrega 15/15 PASS y recuperación E4. No es un recorrido productivo único entre Gmail y todos los agentes. Mantener la exclusión sintética de oportunidades, cierres y pagos.


## Recorrido Gmail con ejecutores aislados — 15 octubre 2026

[Recibos y alcance del caso QA-20261015-2125](../audits/ISOLATED_GMAIL_AGENT_CHAIN_20261015.md): ISOLATED_TECHNICAL_CHAIN_PASS con código existente RSI-01, MARKETING, RSI-02 y RSI-03; seis mensajes Gmail leídos, revisión de Dirección y recuperación independiente sin repetir trabajo. Transporte dirigido por operador y almacenamiento local QA. No acredita ciclo comercial autónomo en Vercel, aprobación de comprador ni pago; conservar los blockers observados.
