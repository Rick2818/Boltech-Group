# Guía de conversión de Leo

Fuente de trabajo: `Boltech_Guia_Conversion_Leads_Explee.docx`, preparada para Rick el 7 de noviembre de 2026. La guía operativa es una adaptación de Boltech, no una metodología oficial ni una integración con Explee.

## Comportamiento implementado

Cada mensaje recibido produce contexto de calificación y eventos internos. Leo pregunta por problema, herramientas, volumen, resultado, decisor, fecha, presupuesto y aceptación, con una pregunta por turno. El contexto se incorpora a la llamada de IA existente; no se añade una segunda generación para calificar. Los mensajes sobre precio, objeciones y pruebas tienen orientación específica. La lógica determinista es conservadora y puede requerir aclaraciones de lenguaje libre.

Todos los datos extraídos son declaraciones del visitante. El presupuesto queda pendiente de compatibilidad con un alcance aprobado; la viabilidad necesita revisión técnica. Por eso el puntaje automático tiene un máximo de 7 sobre 10, y no se presenta como una oportunidad completamente calificada ni como una propuesta aprobada. La información completa pasa a `TECHNICAL_REVIEW`. No se infieren pagos, aceptación comercial, entrega o ventas de los mensajes.

Los estados de preparación no son comprobantes de una acción externa. El cierre pagado sigue dependiendo del canal contractual y de sus recibos verificados. No se modifica Wompi ni se activa la fábrica retirada.

## Triggers y límites

| Evento | Acción interna | Límite y responsable |
| --- | --- | --- |
| MESSAGE_RECEIVED | Recalcular contexto | Leo, una vez por petición identificada |
| QUALIFICATION_UPDATED | Conservar declaraciones y faltantes | Hasta ocho campos; nunca verificar pago |
| OBJECTION_DETECTED | Orientar la respuesta | Precio, aplazamiento, pruebas o solicitud de precio |
| PILOT_DRAFT_PREPARED | Estructurar borrador interno al completar los ocho campos | Un flujo y una integración; precio, costos recurrentes y fecha pendientes de revisión |
| NEXT_STEP_PREPARED | Guardar pregunta o revisión del piloto | Solo preparado; sin fecha ni envío prometido |
| FOLLOWUP_STOPPED | Pausar la solicitud | Sin más preguntas hasta reanudación explícita |

No se instala cron, webhook externo ni automatización de ChatGPT. La guía se ejecuta al recibir conversación; no contacta al visitante cuando está ausente. Un seguimiento posterior con fecha, consentimiento y envío sería una integración adicional que debe conservar las autorizaciones existentes. No reactivar Explee, cold email, Agente 1, mercadeo ni ejecutores retirados.

El borrador interno se devuelve en `conversion.pilotDraft` y se conserva con la sesión cuando Redis está configurado. Incluye problema, resultado deseado, volumen, herramientas declaradas, decisor, fecha solicitada, presupuesto declarado y criterio de aceptación. No representa una integración verificada ni una cotización aprobada. Los bloqueos de revisión quedan enumerados explícitamente.

## Persistencia

El adaptador usa las variables Redis existentes y una cookie aleatoria de 256 bits, HttpOnly, Secure y SameSite Lax. El identificador se almacena como hash. Cada navegador tiene memoria separada; no es identidad de comprador ni reemplaza autenticación de tenants.

Una sesión conserva los últimos 16 mensajes, hasta ocho campos declarados y 40 eventos. Se aplica vencimiento de 30 días de inactividad. Las escrituras usan lease de 60 segundos y comprobación atómica de propiedad. Se recuerdan 32 identificadores de petición: la última se devuelve sin regenerar y las anteriores se rechazan sin repetir trabajo. No se instalan dependencias nuevas ni servicios facturables.

Si Redis no está configurado, la respuesta indica `NOT_CONFIGURED` y la guía utiliza el historial que entrega el navegador; no promete memoria duradera. Si Redis está configurado y falla, se devuelve 503 sin afirmar persistencia ni respuesta completada. La memoria aún requiere comprobación en el entorno productivo.

## Despliegue actual y bloqueo observado

La web vigente se consultó en `https://boltech-group.pages.dev/sales-agent`. Su respuesta de chat declara `provider: workers-ai`. El servicio privado de Cloudflare no está en main ni en la copia pública `backup/cloudflare-public-20261107`; su código no se puede recuperar desde los archivos públicos. Cloudflare Dashboard abrió la pantalla de inicio de sesión en este entorno.

`lib/leo_sales_runtime.js` es la integración probada del repositorio Node. No se afirma que sea el Worker servido en Cloudflare. `cloudflare/public/sales-agent.html` conserva la interfaz pública recuperada y añade ID de petición y progreso cuando el backend entrega el nuevo contrato. Es un parche de interfaz; no es un paquete autónomo desplegable y no debe sustituir al Worker privado ni a sus rutas de pago.

Para completar producción: recuperar el Worker vigente con acceso autorizado a Cloudflare; integrar la política y la memoria en su llamada actual a Workers AI usando sus bindings existentes; ejecutar la batería equivalente, comprobar preview y desplegar con rollback. Verificar luego el proveedor, versión de guía, conversación ES/EN, readback de memoria, detención/reanudación, rutas de voz y las rutas de Wompi sin cobros. No desplegar main en Vercel como sustituto de la producción actual.

## Pruebas y reversión

Ejecutar `node --test tests/test_leo_conversion_guide.mjs tests/test_leo_conversion_http.mjs tests/test_leo_conversion_frontend.mjs tests/test_leo_sales_runtime.mjs tests/test_leo_idle_ai_cost.mjs tests/test_leo_language_session_regression.mjs tests/test_sales_dot_pilot.mjs tests/test_sales_factory_synthetic_circuit.mjs`.

Validación local del 7 de noviembre de 2026: 38 pruebas aprobadas sin fallos y `npm run build` correcto para 271 módulos. Incluye ocho respuestas de un lead sintético, borrador interno, ES/EN, datos incompletos, rechazo y reanudación, IDs repetidos, sesiones separadas y fallas de almacenamiento y proveedor. El circuito histórico de fábrica se ejecutó solo como regresión sintética; no se habilitó fabricación. La conexión de navegador al panel Cloudflare agotó el tiempo de espera; no hay acceso administrativo verificado desde esta sesión.

Las pruebas usan datos sintéticos y dependencias inyectadas. No comprueban la calidad de respuestas de un modelo real, Redis productivo, llamadas de Workers AI, ni ventas. Las pruebas de memoria comprueban contrato HTTP, errores y controles del adaptador; la aceptación del script por Redis real debe verificarse antes del despliegue correspondiente.

Revertir el commit de esta integración o restaurar la versión previa de Cloudflare una vez publicada. No borrar ni migrar registros de pago. Las claves de conversación nuevas están aisladas bajo `leo:conversion:v1:` y caducan sin alterar los objetivos existentes.
