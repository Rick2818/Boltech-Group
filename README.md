# Boltech Group

Agentes preelaborados y agentes a medida para atender consultas y automatizar procesos de empresas. Los alcances y precios se definen mediante cotización aprobada.

**Actualizado: 11 de noviembre de 2026.** El destino vigente es **Cloudflare Pages**. Vercel no es el destino de nuevos despliegues. La Fábrica de Agentes y Agente 1 están retirados por decisión del propietario; su código y documentos antiguos no autorizan reactivarlos.

## Accesos

| Recurso | Enlace |
|---|---|
| Sitio de Boltech | [boltech-group.pages.dev](https://boltech-group.pages.dev) |
| Leo, atención web | [Hablar con Leo](https://boltech-group.pages.dev/sales-agent) |
| Catálogo y preguntas frecuentes del cliente | [Configurar mi agente](https://boltech-group.pages.dev/customer-setup) |
| Manual de usuario | [Manual en la web](https://boltech-group.pages.dev/manual-usuario) · [Fuente en Git](docs/Manual_de_usuario.md) |
| Implementación de la ficha | [Notas operativas](docs/ops/customer-setup.md) |
| Prueba ficticia de Pdro Imports | [Alcance y resultados reproducibles](docs/ops/pdro-imports-synthetic-delivery.md) |

## Recorrido del cliente

1. Boltech y el cliente acuerdan el alcance y la cotización. El pago se comprueba por su procedimiento correspondiente; llenar una ficha no acredita pago.
2. El propietario abre la ficha, despliega **Boltech · Gestión del pedido**, introduce la referencia y genera un enlace privado para ese cliente. Requiere sesión de propietario iniciada en Leo.
3. El cliente carga descripción, catálogo o servicios, FAQ, horarios, políticas y responsable de atención humana. Los datos desconocidos se dejan pendientes.
4. La ficha se guarda cifrada, vinculada al pedido y con una versión propia. El cliente puede descargar una copia JSON.
5. Boltech revisa la versión; el cliente prueba sus respuestas y acepta la configuración revisada.
6. La conexión del canal, la verificación del modelo de IA, las pruebas con proveedores y la entrega operativa se comprueban por separado. La aceptación de la ficha no los certifica.

El enlace privado vence a los siete días. La ficha se conserva hasta 30 días desde su guardado. Cada enlace permite acceder únicamente a su ficha; no otorga permisos de propietario.

## Alcance implementado

| Componente | Comportamiento |
|---|---|
| Ficha de configuración | Formulario vacío, con catálogo/servicios, FAQ y políticas proporcionados por el cliente |
| Guardado | Validación en servidor y cifrado AES-GCM en el binding COMMERCE existente |
| Revisión | Aprobación del propietario sobre una versión inmutable |
| Prueba de conocimiento | Consulta de FAQ exactas, nombres/SKU de productos y horario; datos ausentes se derivan al responsable |
| Aceptación | Aceptación de esa configuración, sin declarar pago ni activación |
| Pdro Imports | Prueba ficticia separada de ventas, contactos y pagos reales |

La prueba de conocimiento actual usa reglas; no acredita inferencia generativa ni sincronización de inventario. La verificación previa de WhatsApp se omite por instrucción del propietario, quien indicó que ya se realizó; este cambio no vuelve a certificarla. El estado de Upwork, Freelancer y Explee se comprueba mediante los controles privados de Leo, no por una afirmación histórica de este README.

## Desarrollo y comprobación

Node.js 22 o posterior y Python 3. Las pruebas de la ficha y el build reducido no requieren instalar las dependencias de la aplicación histórica.

```bash
node --test tests/test_customer_onboarding.mjs tests/test_customer_setup_gateway.mjs tests/test_customer_support_sandbox.mjs tests/test_leo_owner_session.mjs tests/test_pages_leo_audio_bridge.mjs tests/test_leo_upwork_registration.mjs
python3 scripts/pages_ci.py build
node --check .cloudflare/pages-release/_worker.js
node --check .cloudflare/pages-release-check.js
node --check .cloudflare/customer-setup-check.js
```

Prueba ficticia reproducible:

```bash
node scripts/ops/pdro_imports_sandbox.mjs
node scripts/ops/build_pdro_delivery_preview.mjs
```

Los archivos de `ops-output` son evidencia local de prueba, no registros de clientes reales ni respuestas de Meta. No se publican como activos del sitio.

Para trabajar con el resto del repositorio, consultar `package.json`, `AGENTS.md`, `.agents/rules/AGENTS.md` y las instrucciones vigentes del propietario. Los scripts históricos de campañas no deben ejecutarse por el solo hecho de existir.

## Despliegue

El workflow **Cloudflare Pages — Leo production** valida PRs sin secretos y despliega los cambios autorizados de `main` al proyecto existente `boltech-group`. Requiere el secreto de Actions `CLOUDFLARE_API_TOKEN` con el alcance documentado. No crea otro proyecto, cron ni suscripción.

Después de publicar, verifica hashes del HTML de Leo y de la ficha, además de la disponibilidad de almacenamiento y sesión. Un PR aprobado o un build local no equivalen por sí solos a producción verificada. Ver [procedimiento de Pages](docs/ops/cloudflare-pages-actions.md).

## Límites de operación

- Wompi y su verificación de pagos conservan su flujo; las fichas no cobran ni reembolsan.
- No se activan campañas, cold email, postulaciones ni gastos por completar una ficha.
- No se guardan secretos, tokens, contraseñas ni datos de tarjetas en Git, el catálogo o las FAQ.
- Los datos de prueba permanecen identificados como ficticios; no cuentan como ingresos ni clientes reales.
- La entrega final requiere comprobar las integraciones y el alcance contratado, además de la aceptación que corresponda.

Los informes anteriores se conservan en Git y en `docs` como historial. [README anterior](https://github.com/Rick2818/Boltech-Group/blob/a283faf5ba0de2567cddc876c176674448c4baf5/README.md): sus referencias a Vercel, RSI o campañas retiradas no describen la operación vigente.
