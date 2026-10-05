# Continuación de verificación partner — 5 octubre 2026

Plataforma seleccionada por Ricardo: Chatbase.

## 2. Flujo con Chatbase

Estado: cuenta accesible, agente BolTech Group creado en Free (bbqYpI2Docz_PawOeiuHe). Dos fuentes públicas sincronizadas; cabina excluida. Instrucciones corregidas y guardadas. Integración CRM pendiente: checkout Hobby solicita tarjeta y autoriza US$40/mes tras siete días; prueba no activada. No hay integración Chatbase en las rutas api/lib revisadas. La demo de cotizaciones permanece local al navegador. El registro de cotizaciones de Boltech se corrigió por separado; no acredita ejecución desde Chatbase.

Aceptación: solicitud controlada desde el agente Chatbase -> acción autenticada -> referencia persistente Boltech -> confirmación visible y lectura independiente. No afirmar precio, entrega o registro externo sin evidencia.

## 3. A2A con partner externo

Estado: bloqueado por identidad/credencial externa aprobada. Chatbase figura PROSPECT, sin enrollment verificado ni A2A habilitado. No activar ni emitir una credencial por asumir que Experts equivale a A2A. 21 pruebas locales de A2A y partners pasaron hoy, incluyendo consentimiento, aislamiento, replay y concurrencia. No equivalen a intercambio externo.

Aceptación: partner real aprobado, Agent Card/capacidad comprobada, credencial independiente, solicitud sin datos de clientes o con consentimiento, Task ID real, lectura por el partner y replay sin duplicado.

## 4. Envío -> respuesta -> siguiente paso

Evidencia real localizada en el buzón ricardo.boltechgroup@gmail.com:
- Enviado: Implementation referrals through Chatbase Experts, 2 octubre 2026 15:58 SV, Gmail 1a0fea061685689e.
- Acuse de soporte: ticket 59108, Gmail 1a0fea07383b84cc.
- Respuesta: 3 octubre 2026 05:48 SV, Gmail 1a10198857fd6092. Chatbase considera pertinente el servicio e indica aplicar a Experts. No confirma aprobación, cliente referido ni intercambio A2A.
- Seguimiento: borrador Gmail 1a10783b8139231a, sin enviar; consulta recepción de la aplicación para evitar duplicarla.

Siguiente paso: corroborar solicitud Experts existente. Crear agente de producto no acredita aceptación en Experts. El registro Airtable Chatbase recUy92sa05Lw22YD mantiene SUBMITTED según declaración de Ricardo, pendiente corroboración del proveedor. No se envió ningún nuevo correo ni solicitud en esta revisión.

## Cierre de la revisión de puntos 3 y 4

Lectura actual completa de Partners: diez registros, ninguno ACTIVE ni A2A Enabled. Las dos identidades QA están PAUSED. No existe contraparte externa elegible en el directorio. No se enviaron tareas a candidatos ni se generaron credenciales.

Punto 4: envío y respuesta del proveedor corroborados; evidencia y siguiente paso actualizados en Partner Activities recNFStXVB81o5CST, conservando el historial y estado PENDING del resultado comercial. Este intercambio de admisión no acredita una solicitud de cliente, respuesta de cotización ni referido cerrado.

## Prueba controlada de solicitud Boltech

Ejecutada 5 octubre 2026 con rick28191@gmail.com, empresa PRUEBA TECNICA Boltech 2026-10-05, sin cliente ni cobro. API confirmó registro RECORDED, referencia 9c46ad95768dd7037668d97fe87a1fa82382ba792758573f1fcde5735c78755a, contacto PENDING; correo FAILED, transport null. Inventario Vercel de variables completo (hiddenProductionEnvCount=0): SMTP_PASS y RESEND_API_KEY ausentes; no hay transporte de envío configurado. Gmail conector no sustituye SMTP del backend. No hay .env local con credenciales, solo .env.example. Búsqueda exacta independiente en HubSpot por ese correo: total0 al corte, no acredita sincronización completada.

Página Experts autenticada muestra formulario vacío; no permite corroborar una solicitud previa ni concluir ausencia. No se reenviaron formularios ni se aceptaron términos. Pendientes: configurar transporte backend autorizado y verificar worker CRM; repetir prueba controlada tras corregir, usando la misma referencia.
