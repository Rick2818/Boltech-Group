# Arquitectura comercial vigente — 22 de octubre de 2026

**Fuente de verdad funcional para correcciones nuevas.** La arquitectura aprobada tiene exactamente DOS roles de ejecución, sin un segundo agente comercial:

1. **Agente 1 — Comercial integral.** Prospección real, validación de empresa y correo, selección de oferta, consumo de material de mercadeo, contacto, seguimiento, cotización, cierre y registro de resultados.
2. **Agente de Mercadeo.** Elabora material distinto para cada día y lo entrega al Agente 1 con versión, fecha, campaña y estado de disponibilidad.

**No existe Agente 2.** Referencias históricas a RSI-02, antiguos agentes de cotización, cierre, orquestador y otras arquitecturas describen implementaciones anteriores; no autorizan reactivación ni son la arquitectura comercial actual.

## Invariantes operativas exigidas
- Ejecución en la nube, sin depender de la computadora local.
- Campaña de las 09:00 hora de El Salvador; objetivo: cinco leads **reales y validados** al día. No inventar ni enviar a contactos sintéticos.
- Máximo cinco correos de prospección al día, con idempotencia y conciliación antes de reintentar; no atribuir un correo enviado sin evidencia de aceptación del proveedor.
- Agente 1 debe consumir expresamente la versión de material entregada por Mercadeo y registrar identificador, fecha y prueba de consumo antes de enviar.
- El contenido publicado debe cambiar entre días; evitar republicar el mismo contenido tres días seguidos mediante hash/identificador de contenido.
- Registro verificable del pipeline: lead -> validación -> material consumido -> contacto -> respuesta -> seguimiento -> cotización -> cierre/cobro.
- Proteger Wompi: **no modificar** su integración ni sus credenciales.
- No reactivar ASMAS ni agentes comerciales heredados. Los flujos antiguos deben auditarse antes de deshabilitarse, evitando romper producción.
- Alertas de GitHub Actions solo cuando exista falla comprobada, distinguida de falso positivo y sin duplicar avisos antiguos.

## Pendiente de certificación técnica
Este documento **no prueba que el flujo funcione**. Para certificar: inspeccionar workflows y procesos desplegados; identificar entrypoint productivo; comprobar integración Mercadeo->Agente 1; ejecutar tests de unicidad y de idempotencia; verificar Gmail OAuth, proveedor de envío y registro de recibos; comprobar campañas y publicaciones diarias con evidencias reales. No declarar ventas autónomas ni envíos funcionales sin recibos productivos.
