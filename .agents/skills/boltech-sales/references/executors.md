# Contrato de los ejecutores comerciales

## Selección de ejecución
Usar primero conectores, APIs o CLI autorizados y disponibles. Descubrir las operaciones reales y sus esquemas antes de invocarlas. No inventar nombres de herramientas ni endpoints. Usar navegador solo con intención de sitio o fallback permitido, siguiendo su skill. Leer las skills de las plataformas que se utilicen.

Esta skill aporta procedimientos. No incluye un servidor, credenciales, temporizador, adaptadores API ni un proceso permanente. Conectar y desplegar esos componentes requiere verificar el entorno real. No prometer autonomía con la laptop apagada hasta comprobar ejecución en la nube.

## Funciones y evidencias
| Función | Ejecutor necesario | Evidencia mínima |
| --- | --- | --- |
| Investigación | Buscador web o conector de fuente | URL, fecha, hallazgo real |
| Calificación | IA con acceso a evidencia y catálogo | Motivo sustentado y campos completos |
| Registro | CRM o repositorio persistente existente | ID y lectura posterior |
| Contacto | Correo o mensajería autorizados | ID del proveedor y estado |
| Seguimiento | Lector de respuestas y planificador | Conversación, próxima acción, cancelación |
| Propuesta/cierre | Catálogo aprobado y canal comercial | Versión ofrecida, aceptación comprobada |
| Cobro | Consulta del proveedor de pagos existente | Transacción confirmada |
| Supervisión | Ejecutor central con estado persistente | Ejecución, error, recuperación y aviso |

Mapear estas funciones a los agentes existentes después de inspeccionar su configuración. Mantener sus identificadores, responsabilidades y relevos vigentes. No presentar una tabla de funciones como agentes desplegados.

## Requisitos para ejecución en nube
Reutilizar el ejecutor central existente antes de introducir otro. Para un encargo de activación comprobar planificador, autenticación, almacenamiento durable, cola o tareas pendientes, bloqueo contra concurrencia, secretos fuera de archivos, presupuesto de servicios y registro de ejecuciones. Google Cloud y n8n son alternativas posibles, no conexiones activas por defecto. No contar créditos promocionales como saldo concedido sin comprobar cuenta y elegibilidad.

Asignar una clave idempotente a cada acción externa: oportunidad, canal, tipo de acción y versión. Guardar intención antes de ejecutar y recibo después. Si hay timeout y el estado es incierto, consultar al proveedor antes de repetir. Nunca reenviar a ciegas. Reintentar errores transitorios con espera acotada; detener errores permanentes y mantener el resto de trabajos en marcha. No cambiar de remitente para eludir una baja o un bloqueo.

## Pruebas antes de certificar
- Sin acceso a Apollo: comprobar alternativa y conservación de la causa.
- Mismo lead en dos fuentes: comprobar una sola ficha y un solo envío previsto.
- Caída después del envío: reconciliar recibo antes de reintentar.
- Respuesta del cliente: cancelar seguimiento pendiente y transferir contexto.
- Negociación fuera de precio: conservar borrador y escalar la excepción.
- Aceptación sin pago: registrar aceptación sin atribuir ingresos.
- Reinicio: recuperar tareas y próxima acción desde almacenamiento persistente.
- Concurrencia: impedir que dos ejecuciones contacten dos veces.

Etiquetar cada resultado como diseño, simulación QA o prueba productiva. Verificar los efectos en el sistema de destino. Solo declarar operativo el recorrido realmente probado y detallar conexiones faltantes.
