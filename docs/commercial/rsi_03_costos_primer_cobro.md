# RSI-03 — estrategia conjunta A2A, costos operativos y primer cobro
Fecha: 2 octubre 2026.
Estado: política y estrategia documentadas; costos reales, presupuesto y automatización de este RSI pendientes de verificación.

## Mandato
Prioridad comercial: romper el $0.00 mediante un primer cobro genuino y construir una operación sostenible.
Boltech / asistente asume la gestión operativa de análisis de costos, medición, priorización comercial y recomendaciones de ahorro durante sesiones y mediante automatizaciones realmente configuradas. Ricardo conserva titularidad de cuentas, financiación, contratos y decisiones de nuevos gastos. El asistente no financia servicios ni garantiza ventas.
No interpretar la referencia $0.00 como saldo actual verificado: consultar la fuente de pagos antes de reportarlo.

## Inventario y control de gasto
Relevar Vercel, IA/APIs, almacenamiento/CRM, Apollo, Explee, dominios, mensajería, comisiones de cobro y demás proveedores que aparezcan en facturas o configuración. Son categorías a verificar, no costos confirmados.
Por proveedor registrar plan, moneda, costo fijo, consumo variable, créditos incluidos/restantes, renovación, presupuesto aprobado, fuente y fecha. Ausencia de acceso = N/D; cuota gratuita no equivale a costo total cero.
Usar recursos contratados y créditos disponibles antes de ampliar planes. No activar compras, auto recargas o campañas pagadas sin presupuesto autorizado. No cancelar servicios críticos hasta evaluar dependencia y alternativa.
No publicar facturas, credenciales, identificadores bancarios ni información de clientes en este repositorio público.

## Métricas y fórmulas
- Facturado: valor de facturas emitidas; separado de ventas acordadas y dinero cobrado.
- Cobrado: importe verificado por proveedor, con pedidos de prueba excluidos.
- Efectivo neto del período = cobros – reembolsos – comisiones – gastos efectivamente pagados. No es una utilidad contable.
- Contribución por cliente = ingresos del servicio – costos variables atribuibles – comisiones/reembolsos atribuibles.
- Costo de adquisición por tanda = gasto atribuible a adquisición / nuevos clientes pagadores; N/D si no hay clientes.
- Cobertura de operación = contribución total / costos fijos del período; N/D si faltan datos o denominador cero.
Registrar tiempo humano por separado para evitar presentar trabajo gratuito como margen probado. Evitar contar dos veces costos variables entre adquisición y entrega.
Meta 1: primer pago genuino confirmado. Meta 2: contribución positiva por piloto. Meta 3: cubrir costos recurrentes comprobados. Fechas de metas son objetivos, nunca resultados garantizados.

## Estrategia de ingreso
Atender primero interesados reales. Mantener RSI-01 con Apollo y ejecutar RSI-02 en una cohorte separada y deduplicada.
La auditoría gratuita abre una conversación; el piloto es la oferta pagada. Antes de proponerlo calcular costo variable máximo, tiempo de implementación y contribución prevista; precio y condiciones requieren acuerdo de Ricardo.
Priorizar un canal, un proceso y una entrega verificable. No construir funciones adicionales sin oportunidad concreta o necesidad operativa demostrada.
Si el checkout o la entrega carecen de prueba completa, resolver el bloqueo antes de prometer cobro automatizado. Salud técnica no demuestra una venta.

## Ciclo diario y semanal
En la revisión existente de 09:00 SV: comprobar salud y cobros; revisar límites conocidos de consumo; identificar oportunidad más próxima al cobro; elegir una acción comercial y registrar responsable, fecha y evidencia.
En revisión semanal: comparar RSI-01 y RSI-02 por avance y costo, verificar renovaciones, revisar gasto sin resultados y proponer mantener, reducir o reasignar presupuesto.
Prioridad ante bloqueo: datos desconocidos → verificar fuente; interesados sin propuesta → preparar piloto; propuestas sin cierre → resolver objeción; acuerdos sin cobro → verificar pago; cobros sin contribución → ajustar precio/alcance/costo.
Cambiar una variable por ciclo y conservar versión, hipótesis, resultado y decisión.

## Responsabilidades y límites de ejecución
| Actividad | Responsable | Evidencia |
|---|---|---|
| Inventario y análisis de costos | Boltech / asistente | Datos reales y fecha o N/D |
| Investigación, auditorías y propuestas | Boltech / asistente | Fuente, alcance y próximo paso |
| Presupuesto nuevo, precio y contrato | Ricardo | Acuerdo registrado |
| Cobro y conciliación | Boltech + proveedor; Ricardo verifica liquidación | Estado proveedor y referencia privada |
| Comparación de cohortes | Boltech / asistente | Embudo agregado y costos |
No añadir cron duplicado. El control de 09:00 existente no mide todavía todos estos costos ni cohortes: documentado no equivale a automatizado. Automatización posterior exige conectar fuentes y verificar ejecución.

## Criterio de cierre del RSI
Registrar primer pago real con fecha y evidencia privada del proveedor, costo de adquirirlo, costo de entregar el servicio y siguiente oportunidad de repetición. Un estado WON, una factura o un pago sintético no cierran la meta de cobro.

## Canal conjunto de adquisición A2A
Apollo identifica cuentas y socios; RSI-01 mantiene la prospección habitual; RSI-02 ofrece auditorías gratuitas; RSI-03 coordina referidos A2A, cierre, cobro y contribución.
Hipótesis: socios con relaciones comerciales reales pueden aportar oportunidades calificadas a menor costo de adquisición. Medirla por socio antes de ampliar.

### Oferta y habilitación
Priorizar hasta tres socios complementarios (implementadores CRM, agencias B2B o consultores de operaciones) con clientes del ICP y relación verificable. No asumir que los proveedores tecnológicos candidatos ya son socios comerciales.
El socio identifica la necesidad y presenta a Boltech; Boltech realiza diagnóstico, prepara piloto y entrega el servicio. Acordar atribución, responsabilidades, alcance, precio, comisión, reembolsos y quién factura antes de operar. Ricardo aprueba condiciones.
La comisión se calcula sobre la base de dinero cobrado definida en el acuerdo; sin porcentaje inventado. Registrar obligación y pago de comisión por separado.
Usar A2A técnico solo con credenciales, consentimiento y validación comprobados. Un acuerdo comercial permite referidos manuales privados mientras se valida la conexión; no habilita automáticamente acceso A2A.
Deduplicar por dominio/oportunidad en Apollo, Leads y Referrals. Una cuenta tiene un responsable y una oferta principal; preservar origen y socio atribuido sin contar una misma venta dos veces.
Registrar partner_id, referral_id, cohorte, necesidad, consentimiento, responsable, etapa, siguiente acción y referencia privada de pedido/pago. Excluir QA y referrals sintéticos.

### Plan de acción autorizado
Los días son jornadas operativas desde el inicio de ejecución; no constituyen envíos programados ni fechas garantizadas de cierre.

| Plazo | Acción | Responsable | Evidencia de terminación |
|---|---|---|---|
| Día 1 | Incorporar A2A en RSI-03 y actualizar PR/README | Boltech / asistente | Documentos versionados |
| Día 1 | Verificar planes, consumo, créditos y renovaciones | Boltech; Ricardo aporta acceso faltante | Inventario con fuentes o N/D |
| Días 1–2 | Preparar cohortes Apollo habitual y auditoría sin duplicados | Boltech | Cuentas y decisores verificados |
| Días 1–2 | Evaluar hasta tres socios complementarios | Boltech | Encaje, relación y estado comprobados |
| Días 2–3 | Ofrecer auditorías por canales disponibles y autorizados | Boltech | Entrega y respuesta genuinas |
| Días 2–4 | Preparar y acordar colaboración con socios | Boltech + socio; Ricardo aprueba términos | Acuerdo y responsables |
| Días 3–5 | Ejecutar auditorías aceptadas | Boltech + cliente | Informe con muestra y evidencia |
| Días 4–7 | Demostrar flujo y presentar piloto pagado | Boltech; Ricardo aprueba precio/contrato | Propuesta y costo máximo |
| Días 5–10 | Resolver objeciones, formalizar y verificar pago | Ricardo + Boltech | Acuerdo y cobro proveedor |
| Tras piloto | Medir entrega, contribución y repetibilidad | Boltech + cliente/socio | Aceptación y decisión RSI |

### Evaluación por socio
Medir referidos genuinos, aceptados, auditorías, propuestas, pilotos, clientes pagadores, cobros y costo de adquisición por socio. Separar ausencia de datos de cero.
Contribución de caja por oportunidad = cobro confirmado – reembolsos – comisión del proveedor de pago – comisión del socio – costos variables de adquisición y entrega, sin duplicar partidas. Comparar también contribución prevista/real del servicio y tiempo humano.
Revisar semanalmente origen, muestra, objeciones y margen. Mantener socios con oportunidades reales y contribución sostenible; ajustar oferta si hay interés sin cierre; no escalar por cantidad de referidos.
El primer cobro puede provenir de cualquiera de los tres canales. El cierre de la hipótesis A2A exige además atribución comprobada al socio y una entrega aceptada.

### Estado de implementación
Plan comercial aprobado por Ricardo el 2 octubre 2026. La actualización documental no prueba contactos, acuerdos, socios activos, ejecución de auditorías ni cobros.
La revisión existente de 09:00 se conserva; integrar costos y métricas A2A a su reporte requiere implementación y verificación. No se añade un cron.
