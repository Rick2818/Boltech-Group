# Relevos automáticos de ventas

Implementación: 8 octubre 2026. Reutiliza RSI-01, RSI-02, RSI-03, sus BOOTSTRAP, el almacenamiento compartido y el ciclo horario existentes. No agrega agentes ni calendarios.

1. RSI-01 verifica una respuesta humana de su seguimiento autorizado. Crea un relevo durable para RSI-02 con oportunidad, propietario y Message-ID. Repetir el ciclo conserva un solo relevo y repara la entrada de su cola.
2. RSI-02 acepta el relevo, comprueba CRM y Gmail, guarda la declaración del cliente y el diagnóstico en su Evidence existente. Si falta una aprobación individual firmada de alcance, precio, costos y evidencia técnica, conserva WAITING_DIRECTOR_APPROVAL. Una respuesta no implica necesidad confirmada ni aceptación de una propuesta.
3. Con aprobación válida de Dirección para esa oportunidad, cliente y respuesta, RSI-02 crea el relevo para RSI-03 y completa el relevo recibido.
4. RSI-03 verifica la aprobación y la respuesta, registra el caso de cierre y completa la recepción. La propuesta, aceptación explícita, enlace de cobro, comprobación del proveedor y aviso a Dirección siguen los controles existentes. Completar un relevo prueba recepción de responsabilidad; no prueba pago ni entrega.
5. Dirección verifica el pago y el aviso emitido antes de informar a Ricardo. No se contabiliza una simulación como ingreso.

La simulación usa los módulos reales con CRM, Gmail, proveedor y almacenamiento ficticios en memoria. Los dos relevos se ejecutan por los ciclos de los agentes sin intervención del simulador; la aprobación de Dirección es un dato de prueba explícito. La prueba rechaza respuestas automáticas y firmas alteradas, conserva propietario/versiones y comprueba reejecución sin duplicados.

Alcance actual: respuestas del seguimiento autorizado de RSI-01. No convierte todos los contactos del CRM en oportunidades ni activa nuevos mensajes masivos. La validación con cliente real y la semana supervisada siguen pendientes.
