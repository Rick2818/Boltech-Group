# Google ADK aplicado al equipo Boltech

SDK oficial: `@google/adk` 2.2.1, versión fijada en package.json y lockfile.

Cuatro identidades existentes: RSI-01 investiga/contacta; RSI-02 califica/propone; RSI-03 cierra e informa a Dirección; MARKETING apoya esas tres etapas. Dirección verifica antes de informar a Ricardo y no cuenta como quinto agente comercial.

La API privada `rsi-execute` usa BaseAgent y el Runner oficial ADK. El ejecutor conserva sus bloqueos y recibos durables en Redis y Airtable. Las sesiones ADK son efímeras por petición; la memoria comercial permanece en los almacenes existentes. No se han creado nuevos calendarios, emisores ni campañas.

Presupuesto para modelos: USD0. Modo CUSTOM_CODE, sin LlmAgent, claves de modelo, fallback ni llamadas a Gemini. Pedir el SDK no autoriza consumo facturable. Activar un modo de modelo produce ADK_MODEL_BUDGET_NOT_AUTHORIZED.

Mercadeo tiene BOOTSTRAP:MARKETING y recibo propio. Genera un paquete para cada agente de ventas, preservando historial y autorización. Preparar materiales no acredita envío ni pago. La coordinación firmada por rol y las colas privadas registran solicitudes y aceptación; cualquier alternativa requiere resultado anterior registrado.

Validación: pruebas del Runner real, exactamente cuatro identidades, cero red en pruebas de orquestación, rechazo de entradas/identidades inválidas, fallos sin reintento automático, preservación de historial y recibos. La semana supervisada exigida por REGLA-DE-ORO.md sigue pendiente; no declarar autonomía comercial total ni primer ingreso por una prueba técnica.

Documentación oficial: https://adk.dev/get-started/typescript/ y https://github.com/google/adk-js.
