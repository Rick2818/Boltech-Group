# Objetivo rector permanente — Boltech Group
**Decisión de Dirección General: 14 de noviembre de 2026.**
**Ámbito:** todas las decisiones, tareas, agentes, integraciones, procesos comerciales y revisiones de Boltech.

## Norte empresarial
Boltech debe operar como un **sistema de negocio**, no como un empleo que depende de la presencia constante de su propietario.
**Prueba decisiva:** que el propietario pueda ausentarse **14 días consecutivos** y la empresa siga atendiendo solicitudes, generando oportunidades autorizadas, vendiendo, cobrando, entregando y dando soporte, con intervención humana solo en excepciones definidas.
**Advertencia:** la automatización no garantiza nuevos clientes ni depósitos diarios; los ingresos deben provenir de contratos y transacciones reales, no de simulaciones.

## Circuito único de valor — de punta a punta
1. **Atracción y captación:** tráfico entrante consentido al sitio y oportunidades genuinas en canales autorizados; investigación de proyectos de Upwork/Freelancer permitida en solo lectura. No cold email, mensajes, bids ni Connects sin autorización.
2. **Atención, calificación y venta:** **Leo** conversa en español/inglés, entiende necesidad, identifica encaje, registra contexto, prepara ofertas con alcance/precios aprobados y solicita aprobación cuando corresponda.
3. **Aceptación y cobro:** usar el flujo vigente de **Wompi sin modificarlo**. El estado «pagado» exige confirmación genuina del proveedor, vinculada de forma idempotente a pedido y cliente; un chat o ficha no prueba pago.
4. **Cumplimiento, pruebas y entrega:** reunir requisitos, configurar el agente comprado, conectar herramientas aprobadas, ejecutar pruebas reales, entregar documentación y obtener aceptación. Si no se puede automatizar con seguridad, abrir una excepción trazable.
5. **Retención e ingresos recurrentes:** ofrecer soporte/mantenimiento recurrente bajo condiciones aprobadas, comprobar renovaciones y medir churn, cobros y salud de clientes. No generar cargos no autorizados.

## Regla para cada tarea
Antes de implementar un cambio, responder y documentar:
- **Etapa del circuito** a la que contribuye y cuello de botella real que resuelve.
- **Métrica de negocio** afectada (o riesgo operativo que disminuye).
- **Evidencia actual** de funcionamiento, sin inventar integraciones, resultados o clientes.
- **Acción automática permitida** y decisión que requiere aprobación del propietario.
- **Prueba reproducible** y criterio de finalización con recibos reales cuando aplique.
Priorizar completar una transacción verificable de punta a punta sobre añadir otra herramienta, dashboard, agente o automatización aislada.

## Indicadores y prueba de autonomía
Mantener visibilidad de: solicitudes recibidas y verificadas, oportunidades calificadas, propuestas aprobadas/enviadas con recibo, adjudicaciones, **pagos confirmados**, pedidos implementados, **entregas aceptadas**, ingresos recurrentes efectivamente cobrados y excepciones abiertas.
**Hito 1:** primera venta **real** cobrada y entregada sin intervención manual evitable, preservando compuertas de autorización.
**Hito 2:** repetición confiable del circuito.
**Hito 3:** ensayo de **14 días**, con bitácora, monitoreo y alertas excepcionales; evaluar continuidad operativa e ingresos efectivamente percibidos. No proclamar éxito por jobs ejecutados, CI verde ni datos ficticios.

## Estado y límites vigentes
- **Leo** es el agente central de atención/comercio. **Agente 1** y la **Fábrica de Agentes** están retirados; no reactivarlos.
- **Cloudflare Pages** es el destino actual de producción. **Vercel** queda retirado para nuevos despliegues.
- No modificar **Wompi**, secretos, cuentas, permisos, precios, campañas, gastos, crons ni producción sin autorización aplicable.
- No activar cold email, envíos a terceros, postulaciones, Connects ni mensajes comerciales autónomos sin permisos y evidencia.
- Pruebas sintéticas (p. ej., Pdro Imports) nunca equivalen a clientes, cobros o entregas reales.
- Este documento es una **directriz estratégica**, no certificación de que el circuito ya funcione. Consultar el estado operativo reciente y validar producción por separado.

## Precedencia y uso
Esta decisión actualiza la **prioridad empresarial**, sin derogar controles de seguridad de `REGLA-DE-ORO.md` ni `.agents/rules/AGENTS.md`. Si un documento histórico contradice decisiones posteriores explícitas (retiro de Agente 1, fábrica, Vercel o campañas), no reactivar el componente por su sola presencia en Git.
Iniciar cualquier trabajo nuevo de Boltech leyendo **este objetivo**, `AGENTS.md`, `README.md` y el estado operativo más reciente.
