# Boltech — Estándar de calidad y entrega de agentes tipo Dot
Fecha: 2026-10-27. Estado: **estándar de aceptación técnica propuesto**, no acreditación productiva.

## Fuentes revisadas
- https://help.openai.com/en/articles/20001530-getting-started-with-your-dot
- https://help.openai.com/en/articles/20001529-dots-privacy-security-and-safety-faqs
- https://developers.openai.com/api/docs/guides/agents/sdk
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- https://developers.openai.com/api/docs/guides/agent-evals

## Definición operativa de agente de calidad mundial
No es una etiqueta ni una promesa de error cero. Es un contrato medible por especialidad: cumple los criterios del cliente en tareas reales, conserva contexto útil y la continuación de tareas, utiliza conectores autorizados con límites, traza su actividad, controla gastos, reconoce límites, no inventa ejecuciones y admite revisión/corrección. Un Dot de OpenAI incorpora computador en la nube, apps, memoria y persistencia; Boltech debe implementar sus propias capacidades y no declararse equivalente por tener una mascota.

### Tres puertas obligatorias e independientes
1. **VENTAS → FÁBRICA** (dueño: Agente 1/Dot de Ventas; ejecutor de traspaso): identidad del cliente, aceptación explícita verificable, alcance, criterios de aceptación, cotización aprobada, SKU, versión y recibo durable. El receptor confirma que leyó y persistió *exactamente* el mismo pedido/fingerprint. Conflicto, timeout o falta de recibo = BLOQUEADO, nunca "entregado". Reintentos idempotentes y lease/CAS.
2. **FÁBRICA → QA** (dueño: ejecutor de fabricación): plan versionado, plantilla aislada y especialidad, herramientas y permisos, sandbox por tenant, límites de modelos/costos,  pruebas funcionales por tarea real, negativas de seguridad y segregación, trazas y rúbrica. No se permite cambiar alcance silenciosamente. Los fallos crean bloqueos y nueva versión aprobada; no reusar certificación vieja.
3. **QA/PAGO → CLIENTE** (dueño: ejecutor de entrega): QA aprobada con evidencia vinculada al commit exacto + pago verificado por proveedor y conciliado + aprovisionamiento del tenant y cuentas bajo mínimos permisos + comprobación de acceso del destinatario + recibo real e idempotente de envío. La recepción y conformidad del cliente son un evento independiente; jamás inferir entrega de un checkout o estado READY.

### Indicadores de aceptación (umbrales iniciales Boltech, deben calibrarse con datos reales)
- **100%** de acciones de impacto externo tienen autorización explícita, controles servidor y recibo.
- **0** accesos entre tenants, secretos expuestos, duplicados de entrega o resultados de ejecución falsamente declarados en batería de pruebas.
- **>=95%** de las tareas de referencia pasan rúbrica funcional con pruebas deterministas y evaluación humana de casos críticos; tareas reguladas = revisión de experto.
- **>=99%** de handoffs recuperables en ensayos de fallos inyectados, sin pérdida de pedido ni dobles efectos. No prometer 100% disponibilidad.
- Se exige resultado reproducible en español e inglés cuando contratado, latencia y costo medidos, política de privacidad, plan de soporte y rollback.
- **Mínimo tres escenarios sintéticos de integración**: entrega feliz, QA o pago fallido, y reintento/concurrencia; completar después una matriz más amplia con secretos aislados y pruebas de herramientas y acceso reales.

### Orden de implementación
F0. Inventariar runtime actual de mascotas, habilidades, modelos, conectores, hosting y flujo de pedidos; mapear puntos no implementados.
F1. Contrato de eventos durables versionados: ORDER_ACCEPTED → FACTORY_ACK → BUILD_PLAN_APPROVED → BUILD_COMPLETED → QA_CERTIFIED → PAYMENT_VERIFIED → TENANT_PROVISIONED → DELIVERY_SENT → CLIENT_ACCEPTED. Eventos inmutables; correlación por orderId, version, digest y eventId; lectura de vuelta, lease, reintentos limitados y dead-letter.
F2. Adaptar los **dos ejecutores lógicos** al ledger actual (sin cron adicional), con separación comercial/fabricación; registrar evidencia verificable en backend, no en navegador.
F3. Registrar plantillas del catálogo por versión. Configuración por tenant y secretos en servidor. Dot-like: objetivo, memoria autorizada, herramientas, tareas persistentes, revisiones humanas, estados y trazas.
F4. Matriz de QA con pruebas sintéticas + pruebas de integración de herramientas + pruebas reales con supervisión, validación de accesos de dos clientes, costo/latencia, recuperación, audit logs y revisiones por especialidad.
F5. Entrega bajo prueba de pago proveedor, aprovisionamiento y confirmación de acceso. Soporte, consentimiento, revocación, renovación y rollback verificados.
F6. Canario y aprobación de liberación solo cuando todas las puertas estén certificadas. Alertas por fallo y automatización de reconciliación sin duplicar cron.

### Estado de evidencia
Las pruebas con dobles de prueba y los checks de GitHub demuestran contratos de software; **NO** certifican construcción de mascotas funcionales, memoria estilo Dot, herramientas externas, tenant real, cobro o entrega al comprador. La implementación de ese extremo a extremo sigue pendiente y no debe pasar a producción hasta validación con recibos productivos.
