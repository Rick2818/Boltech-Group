# Auditoría del recorrido comercial — 8 octubre 2026

Responsable: Dirección / Codex. Alcance: los cuatro responsables existentes, seguimiento autorizado de RSI-01, relevos de ventas, cierre, aviso a Ricardo, Mercadeo, identidad, fallos y recuperación. Ninguna prueba ficticia cuenta como ingreso.

## Fallos reproducidos y corregidos

1. Una respuesta automática dejaba el seguimiento en un estado terminal y ocultaba una respuesta humana posterior. Se conserva la pausa de envío y se vuelve a consultar el hilo para detectar la respuesta humana.
2. La selección de la primera respuesta podía preferir interés antiguo sobre una negativa posterior. Se prioriza la respuesta humana más reciente; se vuelve a revisar incluso después de registrar interés. Los relevos y el cierre respetan los marcadores de exclusión persistidos en las notas reales del CRM.
3. RSI-03 conciliaba un envío incierto con un resultado de búsqueda único sin verificar completamente el mensaje. Ahora exige mensaje enviado, remitente, destinatario, hilo, RFC Message-ID, contenido y fecha correctos. El mensaje incorrecto mantiene el bloqueo y nunca autoriza reenvío.
4. La devolución RSI-03 → RSI-02 se guardaba fuera de la cola comercial consumida y el consumidor rechazaba ese origen. Ahora se indexa en la cola durable existente y RSI-02 recibe la aclaración; una revisión de alcance sigue exigiendo aprobación individual válida.

Se reprodujeron los tres primeros con pruebas fallidas antes de corregirlos. La devolución de RSI-03 también produjo RELAY_SOURCE_MISMATCH antes de la corrección. Las nuevas pruebas pasan con la corrección, incluyendo exclusión después de aprobar el caso.

## Evidencia

- Batería ampliada: 120 pruebas aprobadas, cero fallidas. Incluye identidad, duplicados, concurrencia, recibos tardíos, integración de Mercadeo, cierre, aviso y prohibición de modelos pagados.
- Simulación completa usa módulos reales con proveedores ficticios y red bloqueada. Comprueba los relevos automáticos y la cadena de aviso; no acredita un cliente ni un cobro real.
- Lectura actual de Gmail: cuenta comercial verificada; A y L tiene un solo mensaje inicial, ID 1a111c53c5218506, enviado el 6 octubre. No se encontró respuesta ni seguimiento adicional al corte.
- Salud local n8n: HTTP200. Esto acredita disponibilidad al corte; la recuperación tras reinicio se había probado previamente, sin promesa de disponibilidad continua.
- Producción anterior a esta corrección: cuatro materiales aceptados, cero usos y cero respuestas verificadas. No hay un pago comercial acreditado.

## Condiciones que siguen pendientes

- Seguimiento de A y L autorizado para el viernes 9 octubre a partir de las 14:00 de El Salvador, sujeto a exclusiones, historial, capacidad y disponibilidad del ciclo. No se adelantó el correo durante la auditoría.
- Uso de material y respuesta humana reales para el punto 8; cierre y aviso de un pago real para la validación comercial de los puntos 2 y 3.
- Una semana de operación supervisada con cliente. No se declara autonomía total ni se garantiza ausencia de errores futuros o disponibilidad de terceros.

La publicación debe comprobarse mediante el SHA de Vercel y el recibo del ciclo de los cuatro agentes. Los recibos de producción se consultan después del despliegue, no se infieren del éxito local.
