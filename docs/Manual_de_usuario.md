# Manual de usuario — Boltech Group

Versión: 11 de noviembre de 2026. Este manual explica cómo preparar, revisar y aceptar la información que utilizará un agente de atención al cliente.

## 1. Dónde entrar

- Leo: https://boltech-group.pages.dev/sales-agent
- Ficha del agente: https://boltech-group.pages.dev/customer-setup
- El cliente utiliza el enlace privado de su pedido que le proporciona Boltech. El enlace general permite preparar y descargar la ficha, pero no guardar datos de un pedido sin ese acceso.

## 2. Qué preparar antes de llenar la ficha

Ten a mano el nombre del negocio, persona responsable, contacto, descripción de lo que ofreces, catálogo de productos o servicios, precios que puedan comunicarse, disponibilidad, horarios, zonas de atención, entregas, garantías y respuestas frecuentes.

No incluyas claves, tokens, contraseñas, datos de tarjetas ni información privada de otros clientes. Si no conoces un dato, déjalo vacío. El agente deberá preguntar o pasar el caso a una persona.

## 3. Para Boltech: crear el acceso del cliente

1. Abre Leo y entra en **Integraciones privadas / Private integrations**.
2. Inicia la sesión de propietario si no está activa. La clave se introduce únicamente en el campo privado correspondiente, nunca en el chat ni en la ficha.
3. Abre **Catálogo y preguntas frecuentes / Catalog & FAQ**.
4. Despliega **Boltech · Gestión del pedido**.
5. Escribe la referencia del pedido. Para Pedro/Pdro Imports usa `SYN_PDRO_IMPORTS_001` y conserva marcada **Pedido ficticio de prueba**. Para un cliente real, usa su referencia correcta y desmarca esa opción.
6. Pulsa **Crear enlace privado del cliente**. El enlace es válido durante siete días.
7. Comparte la dirección del enlace únicamente con el cliente de ese pedido. No lo publiques en GitHub, redes o páginas públicas.

Crear un enlace no verifica que el pedido esté pagado. El pago se comprueba mediante el procedimiento de Boltech y su proveedor.

## 4. Para el cliente: completar la ficha

### Tu negocio

Escribe el nombre de la empresa, responsable, correo y WhatsApp con código de país. Explica qué vende tu empresa, quiénes son tus clientes y qué debe resolver el agente. Incluye horarios con país o zona horaria y las zonas donde atiendes.

### Catálogo de productos o servicios

Pulsa **Agregar producto o servicio** por cada entrada. Completa nombre, referencia/SKU, descripción, condiciones, precio unitario en USD y disponibilidad con fecha de actualización. El precio puede quedar vacío cuando requiera cotización. Puedes quitar una entrada con **Quitar**. Un negocio de servicios puede describir sus servicios o trabajar solo con FAQ.

El precio y la disponibilidad de la ficha son información proporcionada por el cliente; no representan inventario sincronizado, reservas ni ventas confirmadas.

### Preguntas frecuentes (FAQ)

Pulsa **Agregar pregunta frecuente**. Escribe la pregunta como la hace tu cliente y una respuesta que tu empresa pueda cumplir. Ejemplos de preguntas: «¿Cómo solicito una cotización?», «¿Qué datos necesitan para revisar mi pedido?» o «¿Cuál es su política de garantías?».

Evita respuestas ambiguas y promesas que no puedas cumplir. Cada pregunta agregada debe tener respuesta. Puedes agregar hasta 100 FAQ y 100 productos/servicios; la ficha completa admite hasta 24.000 bytes, por lo que conviene escribir respuestas concisas.

### Políticas y atención humana

Describe entregas, plazos, costos, cambios, devoluciones y garantías. Indica quién recibe los casos humanos y qué decisiones requieren su revisión: reclamos, descuentos, cobros, devoluciones u otras excepciones.

### Revisar y guardar

1. Revisa que la información sea correcta.
2. Marca la confirmación de revisión.
3. Pulsa **Guardar en Boltech**.
4. Comprueba el mensaje **Ficha guardada en Boltech** y su referencia de versión.
5. Si quieres una copia, pulsa **Descargar copia de mi ficha**. Descargar no sustituye el guardado en Boltech.

Los datos pendientes permanecen sin confirmar. Guardar la ficha no cobra, no activa WhatsApp y no acredita una entrega final.

## 5. Revisar y probar las respuestas

Boltech abre el enlace privado, revisa la ficha y pulsa **Aprobar revisión de esta ficha** desde su sesión de propietario. La aprobación corresponde únicamente a esa versión de la información.

El cliente puede usar **Comprueba las respuestas de tu ficha** después de guardar:

- Escribir una pregunta frecuente tal como la registró. Se normalizan mayúsculas, acentos y signos.
- Escribir el nombre completo o el SKU de un producto.
- Preguntar por el horario.

Pulsa **Probar respuesta guardada**. Revisa que la respuesta coincida con la ficha. Si el dato falta o la consulta no coincide con esas reglas, la respuesta indica que debe revisarla el responsable. Esta vista usa reglas de consulta; no es una prueba de IA generativa ni envía mensajes por WhatsApp.

## 6. Aceptar o corregir la configuración

Si la versión revisada es correcta, el cliente pulsa **Aceptar configuración revisada**. Esta acción acepta la información del agente, no un cobro, la conexión de un canal ni la entrega operativa completa.

Para corregir datos, edita la ficha y vuelve a guardar. Se crea una versión nueva. Boltech debe revisar esa nueva versión antes de que el cliente la acepte. La aprobación anterior no se transfiere automáticamente a datos modificados.

## 7. Qué sigue antes de una entrega operativa

Boltech debe comprobar el modelo de IA, el canal contratado, el registro de conversaciones, el comportamiento ante errores y los casos que pasan a una persona. Estas verificaciones requieren sus propias evidencias. Una ficha aceptada no certifica esas conexiones.

En el escenario de Pedro/Pdro Imports, empresa y pago son ficticios. Los datos del catálogo de ejemplo llevan esa etiqueta. Por indicación del propietario no se repite la prueba de WhatsApp que informó como ya realizada. El recorrido local incluye conservación de historial, apertura de casos, resolución de un caso por Pedro y recuperación después de reiniciar; no equivale por sí mismo a un agente conectado al canal real.

## 8. Problemas habituales

### No puedo guardar

Abre el enlace privado de tu pedido, completa los campos obligatorios y confirma la revisión. Revisa también el formato del correo y los precios. Si la ficha supera el tamaño permitido, reduce descripciones o entradas. Un error de guardado no debe interpretarse como ficha recibida.

### El enlace venció o no es válido

Pide un enlace nuevo a Boltech. Un enlace recién creado puede tardar en estar disponible; espera unos segundos e inténtalo de nuevo. No publiques la dirección para pedir ayuda.

### No puedo crear enlaces o aprobar

Estas acciones requieren la sesión del propietario de Boltech en Leo. El enlace del cliente no proporciona esos permisos.

### No puedo aceptar la ficha

Boltech debe aprobar la misma versión que estás intentando aceptar. Si cambiaste información después de la revisión, guarda y solicita revisar la nueva versión.

### La respuesta dice que falta información

Completa el dato en el catálogo o las FAQ. Para la prueba actual, usa la pregunta exacta, el nombre completo o SKU del producto. Si el caso requiere criterio humano, el agente debe derivarlo al responsable.

### Se interrumpió la conexión

Comprueba el resultado antes de asumir que el guardado terminó. Reabrir un enlace válido permite recuperar la versión guardada. Conserva una copia descargada para los datos que aún no hayas guardado.

## 9. Acceso, conservación y soporte

Cada enlace privado permite consultar y enviar únicamente la ficha de su pedido. El contenido guardado se cifra. El enlace vence a los siete días; los registros se conservan hasta 30 días desde su guardado. No se recopilan datos de tarjetas o credenciales desde este formulario.

Para pedir ayuda, indica a Boltech la referencia del pedido y el texto del error, sin compartir contraseñas ni la dirección completa del enlace privado. El botón de correo de Leo permite preparar un mensaje al equipo; el envío requiere que lo realices desde tu correo.

## 10. Para mantenimiento técnico

El README del repositorio incluye pruebas y despliegue. Las notas de implementación están en `docs/ops/customer-setup.md`. Cloudflare Pages es el destino vigente. No utilizar instrucciones históricas de Vercel ni reactivar procesos retirados para completar este recorrido.
