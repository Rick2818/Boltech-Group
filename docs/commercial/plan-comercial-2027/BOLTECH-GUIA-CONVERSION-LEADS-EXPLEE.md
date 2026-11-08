# Guía Boltech: convertir leads en clientes

Fecha: 2026-11-08

## Alcance

Este documento separa las referencias atribuidas a Explee de la adaptación propia para Boltech. No certifica que Explee use internamente este flujo ni sustituye evidencia primaria de una cuenta autorizada.

## Qué significa un lead interesado

Una respuesta que permite avanzar —por ejemplo, pedir precio, solicitar una demostración, pedir un piloto o derivar al responsable— se trata como **lead caliente**. No significa que exista una reunión, propuesta aceptada, venta o pago.

## Flujo de conversión de Boltech

1. **Descubrimiento:** identificar el problema y el resultado deseado.
2. **Calificación:** preguntar, de una en una, por proceso, herramientas, volumen, plazo y persona decisora.
3. **Respuesta contextual:** contestar lo que el interesado pidió; no enviar mensajes ni prometer resultados automáticamente.
4. **Demo acotada:** preparar un borrador de demostración con datos sintéticos y alcance verificable.
5. **Piloto:** preparar un borrador con entregables, plazo, precio sujeto a aprobación y criterio de aceptación.
6. **Siguiente paso:** registrar una recomendación de seguimiento y fecha; requiere acción humana.
7. **Cierre seguro:** solo una persona autorizada aprueba cotización, contratación, pagos o envíos.

## Triggers implementados en Leo

| Señal | Clasificación | Siguiente recomendación |
|---|---|---|
| Precio, cotización o presupuesto | caliente | Calificar antes de preparar propuesta |
| Demo o demostración | caliente | Preparar borrador de demo |
| Reunión, llamada o agenda | caliente | Calificar y preparar revisión humana |
| Piloto, prueba o POC | caliente | Preparar borrador de piloto |
| “No me interesa”, “stop” o similar | detenido | Detener seguimiento |
| Consulta general | tibio | Preguntar por problema y herramienta |

Leo devuelve estas señales como metadatos internos (`conversion`). No ejecuta envíos, crea reuniones, cobra, cierra ventas ni registra datos personales sin consentimiento.

## Métricas recomendadas

Medir por etapa: interesados → demos → pilotos → propuestas aprobadas → pagos. Añadir tiempo hasta el siguiente paso, motivo de rechazo y costo por cliente cuando exista evidencia local verificable.

## Reglas de seguridad

- No pedir contraseñas, tokens, códigos ni tarjetas.
- No llamar “reunión” a una solicitud de reunión.
- No llamar “venta” a un lead caliente.
- Detener el seguimiento tras un rechazo explícito.
- Mantener aprobación humana para cotizaciones, contactos externos y pagos.
