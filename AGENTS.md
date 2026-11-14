# Boltech Group — Instrucciones operativas vigentes
**Revisión: 12 de noviembre de 2026.** Las referencias antiguas a Agente 1, Fábrica de Agentes, Vercel y campañas RSI no autorizan su reactivación.

## Servicios permitidos
- **Leo:** único agente web comercial y de atención. Su chat orienta; las solicitudes con consentimiento explícito se reciben en `/api/leo-public-intake`, donde quedan como `NEW_UNVERIFIED`.
- **Motor comercial:** `/api/leo-commerce`, accesible solo al propietario, almacena calificación, propuesta, aprobación, notas de seguimiento y cierre declarado. Una declaración de cierre no es verificación de pago ni de aceptación por un proveedor externo.
- **Mercadeo:** preparar contenidos institucionales y borradores internos, sin publicaciones o mensajes no autorizados y sin presentar evidencias sintéticas como resultados reales.
- **Posventa:** el cliente puede cargar catálogo y FAQ y aceptar una versión revisada en `/customer-setup`. Esto no activa automáticamente su agente ni su WhatsApp.
- **Cobros:** Wompi y sus validaciones existentes se preservan; no modificar pagos o secretos durante otras tareas.
- **Hosting:** la producción oficial de Boltech es Cloudflare Pages, proyecto `boltech-group`, no Vercel.

## Sistemas retirados o suspendidos
Agente 1, Fábrica de Agentes y sus automatizaciones, cold email, prospección por correo, cron antiguos de ventas, campañas RSI y el uso de Vercel como destino de producción. Los archivos históricos o workflows existentes no implican permisos para reactivarlos.

## Autorización y seguridad
- Nunca enviar correos, mensajes WhatsApp, postulaciones, DMs o comunicaciones a terceros sin autorización comprobable, consentimiento de canal y condiciones del proveedor.
- Nunca gastar Connects, créditos ni dinero ni activar nuevas suscripciones sin autorización.
- No crear segundos cron, ni activar cron antiguos para simular operación 24/7.
- Un pipeline verde demuestra lo que se probó; no demuestra cobro, entrega, reconocimiento de voz móvil, permisos OAuth, agente de IA del cliente o autonomía comercial.
- Trabajar con secretos únicamente a través de su almacenamiento seguro; nunca imprimir ni incluirlos en Git.
- Mantener datos de Pdro Imports y otros escenarios sintéticos aislados de clientes, métricas, CRM y pagos reales.

## Criterios de aceptación: ventas reales
1. El cliente da consentimiento y la solicitud se recibe en producción, con un ID.
2. Una identidad y un canal de contacto se comprueban de forma independiente.
3. Leo completa requisitos y calificación con persistencia real y recuperable.
4. La propuesta se genera con precio y alcance aprobados.
5. El envío externo solo ocurre con proveedor autorizado, idempotencia transaccional, control de bajas y recibo de aceptación.
6. La aceptación de compra y el estado de pago se verifican por sus fuentes; nunca inferirlo del texto de un chat.
7. Los seguimientos programados no se consideran ejecutados hasta que existan logs, comprobantes y límites de frecuencia verificados.

## Criterios de aceptación: posventa real
1. Referencia de pedido y prueba de pago según contrato, sin modificar Wompi.
2. Ficha de cliente, catálogo, FAQ y políticas aprobados en versión persistida.
3. Configuración específica del agente, proveedor LLM, credenciales del canal y aislamiento del cliente.
4. Pruebas reales del canal contratado, inferencia, derivación humana, memoria, reinicios y respuesta a errores.
5. Entrega aceptada por el cliente, manual y soporte definidos, con evidencia verificable.

## Estado técnico y referencias
El estado efectivo siempre se comprueba en GitHub Actions, los resultados de las APIs de Cloudflare y el proveedor externo aplicable. Consultar `README.md`, `docs/ops/leo-commercial-ledger.md`, `docs/ops/leo-inbound-and-outbound-readiness.md`, `docs/ops/customer-setup.md` y `docs/ops/leo-production-audit-20261112.md`.

**No declarar «todo en producción» sin pruebas por capa y sin evidencia del despliegue real.**
