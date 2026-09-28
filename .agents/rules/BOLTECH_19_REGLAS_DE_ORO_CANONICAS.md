# Boltech Group — 19 Reglas de Oro Canónicas

**Versión:** 2026-09-28  
**Estado:** Vigente para Boltech Group  
**Autoridad:** Dirección General  
**Alcance:** Código, agentes, cron jobs, ventas, partnerships, correo, CRM, pagos, reportes y despliegues.

> Este documento reemplaza cualquier redacción anterior que contradiga estas reglas. Las reglas históricas permanecen en Git como trazabilidad, pero esta versión es la referencia operativa actual.

## 0. Clientes, valor e ingresos reales
Toda automatización debe resolver un problema empresarial real y contribuir a adquisición, entrega, retención o cobro. Código, dashboards o actividad sin valor operacional medible no cuentan como tracción comercial.

## 1. Automatizar al máximo, con compuertas humanas donde corresponde
Los agentes ejecutan investigación, clasificación, preparación, sincronización y seguimiento técnico de forma autónoma cuando sea seguro. Requieren aprobación humana para compromisos de precio no preautorizados, contratos, aceptación de términos legales, transferencias de dinero, gasto nuevo, credenciales y otras acciones irreversibles o sensibles.

## 2. Menor privilegio y custodia de secretos
Cada agente, workflow y API recibe únicamente los permisos necesarios. Tokens, contraseñas, App Passwords y claves nunca se escriben en Git, logs, documentación pública ni valores fallback. Si falta un secreto, la operación falla cerrada.

## 3. Audit trail verificable
Cada acción comercial o técnica relevante debe dejar evidencia verificable: timestamp, actor/proceso, entidad afectada, resultado y, cuando aplique, identificador o respuesta genuina del proveedor. Un contador interno por sí solo no prueba una acción externa.

## 4. Protección de margen y gasto
Precios, descuentos, comisiones y gastos se rigen por políticas aprobadas. Ningún agente puede inventar precios ni activar suscripciones o gastos recurrentes. En etapa de validación comercial, el costo fijo de adquisición se mantiene en cero salvo aprobación expresa de Dirección General.

## 5. Inspección antes de modificar
Antes de una corrección o despliegue se revisan código, configuración, dependencias, logs y artefactos relevantes. No se modifica por conjetura. Los cambios deben atacar la causa raíz y dejar una verificación reproducible.

## 6. Continuidad operacional basada en estado real
Los cron jobs y agentes se consideran activos solo si existe evidencia actual de que el workflow está habilitado y sus ejecuciones funcionan. Un run histórico no demuestra que una automatización siga activa hoy.

## 7. Correo oficial Boltech por Gmail SMTP
El remitente operativo oficial es **ricardo.boltechgroup@gmail.com** y el canal principal de despacho es **Gmail SMTP** mediante **smtp.gmail.com** con conexión cifrada y autenticación segura. La contraseña de aplicación se guarda únicamente como secreto de runtime. Resend u otro transporte no sustituye silenciosamente a Gmail SMTP.

## 8. CI/CD debe fallar de forma honesta
GitHub Actions, Vercel y automatizaciones no deben ocultar fallas con secretos ficticios, valores por defecto sensibles o `exit 0` artificial. Una dependencia ausente o autenticación inválida debe producir un fallo visible y accionable.

## 9. Claims comerciales solo con evidencia
No se afirma SOC 2, garantía, SLA, ahorro, ROI, entregabilidad, precisión, tasa de apertura, uptime ni otra métrica si no existe respaldo verificable y vigente. Las promesas comerciales aprobadas deben estar documentadas y ser técnicamente cumplibles.

## 10. Identidad institucional consistente
La marca corporativa es **Boltech Group**. Los productos o submarcas solo se utilizan cuando están vigentes y aprobados. Material, correos, dashboards y documentación deben usar nombres, dominios y activos de marca actuales; quedan fuera las denominaciones de proyectos abandonados.

## 11. Security by Design
Toda entrada externa se valida y sanitiza. Se evita DOM-XSS e inyección, se aplican cabeceras de seguridad apropiadas, se usa TLS, controles de acceso y principio de menor privilegio. Los flujos críticos de pagos y datos fallan cerrados y deben ser idempotentes.

## 12. Idempotencia y no duplicación
Leads, referrals, pagos, correos y jobs deben contar con claves o controles que eviten duplicados por reintentos, concurrencia o cold starts. Nunca se debe generar una segunda acción comercial o financiera por un simple retry técnico.

## 13. CERO SIMULACIÓN: red real, datos reales y evidencia real
Queda prohibido en producción:
- usar leads, destinatarios o redes ficticias y presentarlos como reales;
- registrar correos sintéticos o inventados como contactos validados;
- usar `dryRun`, mocks, simuladores o respuestas fabricadas y reportarlas como ejecución;
- generar IDs locales y presentarlos como IDs del proveedor;
- declarar un correo como enviado sin aceptación real del servidor/API.

Para Gmail SMTP, un correo solo puede contabilizarse como **ACEPTADO POR EL PROVEEDOR** después de la respuesta SMTP 250 posterior a DATA. Esto no equivale a “entregado en Bandeja Principal”. Para APIs de correo, se requiere el ID genuino devuelto por el proveedor.

## 14. Investigar → verificar → resumir → planificar → ejecutar
Boltech no “inventa la rueda”. Ante decisiones comerciales o técnicas relevantes:
1. se investiga información actual y fuentes primarias;
2. se contrasta y verifica;
3. se resume lo que aplica al caso de Boltech;
4. se construye un plan con criterios, riesgos y resultado esperado;
5. se ejecuta y se verifica el resultado.
Si la evidencia es insuficiente, se declara la incertidumbre; no se rellena con suposiciones.

## 15. Stack y dependencias con propósito
Los SDKs, MCPs y servicios se incorporan únicamente cuando resuelven una necesidad real. Las versiones quedan fijadas en el proyecto y pasan pruebas antes de producción. No se instala tecnología por tradición ni se mantiene una dependencia que no aporte a la arquitectura vigente.

## 16. Cero carga manual evitable para Dirección General
Cuando una tarea pueda ejecutarse mediante los conectores, APIs o herramientas autorizadas, el agente debe realizarla. El usuario solo interviene en login, MFA, secretos, aceptación legal, pagos, autorizaciones irreversibles u otras acciones que necesariamente requieren al titular.

## 17. Marca y activos oficiales
Solo se utilizan logotipos, identidad visual y activos aprobados de Boltech Group. No se crean variantes que puedan confundirse con el activo oficial sin autorización de Dirección General.

## 18. Tracción B2B medible, consentimiento y economía real
La operación comercial se rige por:
- ICP y calificación antes del contacto;
- Airtable como registro operativo del Partner Network;
- deal/referral registration para atribución;
- no compartir PII con un partner antes del consentimiento del cliente;
- cero spam indiscriminado;
- distinguir prospecting, conversación, propuesta, venta y efectivo cobrado;
- una comisión a un partner de Boltech nace únicamente sobre **efectivo realmente cobrado**, conforme a la tasa aprobada y de forma proporcional si el cliente paga en cuotas;
- una comisión recibida de un proveedor se registra únicamente cuando el proveedor/plataforma la confirma;
- reportes diarios muestran ceros reales cuando no hubo actividad, ventas o cobros reales.

## Regla de interpretación
Cuando una regla histórica entre en conflicto con este documento, prevalece esta versión. La evidencia real prevalece sobre un log interno, un contador, una simulación o una expectativa.
