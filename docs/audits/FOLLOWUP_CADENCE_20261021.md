# Primer seguimiento a tres días calendario

Ricardo seleccionó tres días calendario el 21 octubre 2026 y pidió vincular la regla. Responsable: Agente 1 de Ventas, ejecutor inbox existente y cola Supabase `agent_work`.

Política ejecutable: `config/canonical_followups.json`. Incluir sábados y domingos desde la fecha original del proveedor, conservar hora cuando cae entre 09:00 y 17:00 de El Salvador y ajustar a la siguiente ventana cuando corresponda. Los días festivos también cuentan. La aclaración posterior de Ricardo reemplaza su selección inicial de días hábiles.

Un solo seguimiento sin respuesta. Verificar identidad del remitente, contacto, conversación e historial de contacto completo, rebotes, exclusiones CRM/DNC y límites compartidos. Una respuesta o exclusión detiene la secuencia. Reservar la fila con compare-and-set y lease; guardar intención y Message-ID determinista antes de Gmail. Nunca reenviar un POST incierto; conciliar el recibo del proveedor.

Verificación: pruebas QA aisladas de fechas, fin de semana, deduplicación, concurrencia, fallas y conciliación; CI y despliegue. En producción, verificar vencimientos guardados y procesamiento real. Un contacto no vencido no autoriza una prueba de envío anticipado. No se modifica Wompi ni se reactivan agentes históricos.
