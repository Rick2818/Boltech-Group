# Boltech Group — Política comercial, Fábrica híbrida y seguridad
**Fecha:** 2026-10-27 · **Estado:** estrategia aprobada para planificación; despliegue funcional condicionado a pruebas · **Uso:** interno

## Regla maestra
El cliente compra acceso a un agente funcional y sus resultados, **no** acceso irrestricto al código, secretos, infraestructura ni repositorios de Boltech. Cada oferta documenta alcance, precio, límites, derechos de uso y soporte.

## 1. Ofertas y precios orientativos
| Producto | Precio orientativo | Entregable |
|---|---:|---|
| Agente preelaborado | US$69/mes | Plantilla del catálogo, personalización limitada y cuotas de uso |
| Piloto empresarial | US$600 pago único | 1 workflow y 1 integración simple, validación acotada |
| Agente personalizado | Desde US$900 de implementación | Diseño a medida; operación y soporte cotizados por separado |
| Proyecto complejo | Cotización | Integraciones múltiples, regulación, autonomía u otros requisitos |

**Estos son precios orientativos, no precios finales aprobados para checkout.** Validar costos, margen, impuestos, carga de soporte, consumo y competencia antes de hacerlos vinculantes o publicarlos como una promesa contractual. No prometer uso ilimitado a precio fijo.

- Proyectos de implementación: referencia de 50% al inicio y 50% contra entrega. Las suscripciones tienen condiciones de renovación y cobro propias.
- Descuento histórico de 10%: **no se aplica automáticamente**; requiere reglas comerciales y aprobación.
- Catálogo maestro versionado como fuente única para web, Fábrica/mascotas, Agente 1 y cotizaciones: SKU, versión, moneda, precio, periodicidad, alcance, integraciones, cuotas, extras, soporte, impuestos, estatus de aprobación y fecha de vigencia.
- **Respetar la protección de pagos actual:** se requiere cotización aprobada antes de crear un enlace Wompi; no eliminar el control `APPROVED_QUOTE_REQUIRED`, ni aceptar importes indicados por el navegador. No modificar ni reemplazar Wompi en esta fase.

## 2. Experiencia del cliente: Fábrica híbrida
1. **Elegir** especialidad o mascota: ventas, servicio al cliente, mercadeo, finanzas, logística, química/farmacia u otra por solicitud.
2. **Entrevista guiada:** objetivo medible, problemas, tareas, frecuencia, canales, usuarios y sistemas/datos autorizados.
3. **Alcance y demostración:** propuesta legible, restricciones, plan de cuotas y demo aislada sin credenciales reales de terceros.
4. **Aprobación, contrato y pago:** presentar precio aprobado y condiciones; cobrar solo por el flujo Wompi existente.
5. **Activación:** provisionar tenant, roles, conexiones autorizadas, pruebas de permisos, panel y recibo de entrega.

El visitante puede explorar plantillas; los trabajos con integraciones complejas o datos regulados pasan a cotización humana mediante **Agente 1**, único agente comercial. Mercadeo prepara material para Agente 1, no realiza outreach por su cuenta. No crear agentes comerciales adicionales.

### Accesos
- **Constructor:** acceso temporal con expiración al finalizar la configuración; reapertura sujeta a cambios aprobados.
- **Panel operativo:** continúa mientras el contrato o suscripción otorgue acceso.
- **Instrucciones básicas:** editables conforme al plan; registro de versiones y cambios.
- **Integraciones sensibles:** consentimiento explícito, mínimo privilegio, secretos gestionados en servidor y pruebas.
- **Agentes adicionales:** nueva licencia o proyecto; impedir clonación masiva.
- **Pago único:** definir por contrato propiedad del entregable, licencia, alojamiento, costos recurrentes y soporte; sin mantenimiento perpetuo implícito.

## 3. Arquitectura objetivo
- **Web comercial:** catálogo, páginas ES/EN, descripción honesta de planes, solicitud de cotización y acceso del cliente.
- **Fábrica:** mascotas, selección, entrevista, configuración guiada y demo limitada.
- **Supabase:** identidades, tenants, membresías, roles, planes, suscripciones, auditoría y políticas RLS probadas.
- **Servidor protegido:** proxy de LLM y herramientas, llaves y credenciales nunca expuestas al navegador.
- **Wompi existente:** cobros y conciliación protegidos.
- **Agente 1:** único responsable de prospección, validación, contacto, cotización, seguimiento y cierre; atender escalaciones de la Fábrica.
- **Mercadeo:** suministrar contenido a Agente 1.

**No interpretar este objetivo como funcionalidad ya desplegada.** No agregar cron ni duplicar ejecutores de Supabase/GitHub/Vercel; certificar primero un único dueño de agenda y exclusión mutua.

## 4. Propiedad intelectual y custodia GitHub
**Arquitectura propuesta, no repositorios existentes confirmados:**
- `Boltech-Core` — privado: motor, conectores, políticas y lógica propietaria.
- `Boltech-Agent-Factory` — privado: plantillas, especialidades, configuración y backoffice.
- `Boltech-Group` — únicamente puede ser público si no revela secretos ni propiedad intelectual sensible; de lo contrario, privatizar tras auditoría.

Antes de separar repositorios o cambiar visibilidad: inventario de dependencias, forks, permisos, secretos, historial, Actions, Supabase y Vercel, con plan de rollback. Privatizar **no elimina clones históricos o forks públicos**.

## 5. Controles mínimos obligatorios
1. Secret scanning, auditoría de historial, rotación inmediata de credenciales comprometidas, secretos solo servidor.
2. GitHub Private para IP, revisión de cambios, protección de ramas, MFA y principio de mínimo privilegio.
3. Separación real de clientes: tenant IDs derivados de identidad del servidor, RLS, controles de autorización por cada operación, pruebas entre dos clientes.
4. Uso responsable: términos de servicio, límites técnicos, moderación adecuada, suspensión de abuso y trazabilidad.
5. Herramientas restringidas por agente, validación de entradas y aprobación humana para actos sensibles.
6. Presupuestos por tenant: tokens, ejecuciones, integración, alertas y corte controlado.
7. Auditoría administrativa y de cliente con retención proporcional y sin secretos en logs.

## 6. Secuencia de implementación y criterios de aceptación
**Fase 0 (solo inventario y diagnóstico):** detectar exposición, permisos, costos, crons y dependencias; no cambiar producción. Evidencia registrada.
**Fase 1 (catálogo):** definir esquema y reglas; validar costos/márgenes/impuestos y benchmarking; aprobación comercial explícita. Comprobar que web, mascotas, Agente 1 y cotizaciones consumen **la misma versión**.
**Fase 2 (seguridad):** custodiar módulos privados tras análisis de impacto, RBAC/RLS y auditoría. Tests negativos de acceso entre tenants, ejecución no autorizada y filtración de secretos.
**Fase 3 (Fábrica comercial):** selección → entrevista → propuesta → cotización aprobada → Wompi → webhook conciliado → activación → panel; comprobar reintentos e idempotencia, pagos fallidos y ausencia de provisión sin pago confirmado.
**Fase 4 (publicación gradual):** staging con identidades separadas y pagos simulados; activar por feature flag solo tras pruebas y rollback validado. Revisar costos, incidencias y ventas reales.

### No regresión / límites explícitos
- No activar envíos, suscripciones de cobro, tráfico productivo ni cambios de repositorio en esta fase documental.
- No tocar pasarela Wompi ni el importe del checkout.
- No activar un segundo planificador mientras se verifica exclusividad de Supabase.
- No presentar READY de Vercel como certificación de funcionamiento extremo a extremo.
- No declarar la Fábrica certificada sin pruebas verificables de cada paso.

**Fuente interna:** `Boltech_Estrategia_Fabrica_y_Seguridad.docx` entregado por el propietario el 27/10/2026. Este archivo refleja las decisiones estratégicas y no demuestra una implementación productiva.
