# Agente 1: habilidades, ejecutor y preparación — 20 octubre 2026

## Resultado comprobado

Cinco habilidades documentadas y enlazadas al ejecutor existente, con integración en investigación pública, preparación CRM y clasificación de seguimientos. Modo determinista, cero llamadas a modelos y sin nuevo calendario ni agente. Ver `docs/commercial/AGENT1_SALES_SKILLS.md`.

Validación local: 91 pruebas aprobadas en diez suites de habilidades, preparación, plataformas, seguimientos, sincronización, coordinador, campaña, calendario y despachador; 191 módulos pasan verificación sintáctica. Cinco SKILL.md pasan quick_validate. Revisión independiente de lectura y pruebas completada.

Durante las pruebas se corrigió una interacción entre BANT UNKNOWN y búsquedas textuales de supresión: el bloque generado se excluye del escaneo, conservando estados y notas externos. Regresiones verifican renovación de cinco candidatos, paso al despachador real con proveedor en memoria, reserva durable, envío único y bloqueo de UNKNOWN externo. Los tests del coordinador inyectan descubrimiento público para no consultar red accidentalmente.

Las pruebas con proveedores en memoria no prueban envío comercial productivo, respuesta de comprador, venta, pago ni ciclo autónomo completo. La verificación de despliegue y los recibos productivos se consultan en Harness AutoDoc / issue #86 después de la integración.

## Preparación privada para el martes 20

Archivo canónico: `Boltech_Despacho_2026-10-20.xlsx`, identificador persistente `libfile_7b8e9e2431ec819183b1c377d3d1df53`.

- Cinco empresas nuevas y distintas, con contacto publicado en fuente oficial, proceso observado, hipótesis explícita, teléfono público, MX comprobado y texto completo.
- Dominio ausente del inventario Apollo guardado completo (28 contactos), sin historial Gmail anterior antes de crear los borradores. No garantiza historial eliminado ni existencia del buzón.
- Cinco borradores iniciales y 24 borradores de seguimiento creados y releídos con etiqueta DRAFT, destinatario y hilo verificados. De estos seguimientos, 15 tienen fecha propuesta 20 octubre y nueve se retienen para 21/22 octubre; no se programó envío.
- 65 cuentas históricas conciliadas: una baja explícita, tres cuentas con rebotes, nueve del mercado anterior, 23 secuencias antiguas para revisión, cuatro partnerships, una respuesta con borrador anterior y 24 seguimientos preparados.
- El archivo incluye recibos, asuntos, cuerpos, fuentes, fechas propuestas, motivos de retención y pasos siguientes. No se publican contactos o textos privados en este repositorio público.

La preparación de estos borradores fue asistida mediante conectores; no se atribuye falsamente al ejecutor productivo Agente 2. Los metadatos Gmail acreditan el remitente y el mensaje, no qué agente lo originó. Antes del despacho se requiere conciliación breve de respuestas, bajas y rebotes, sin repetir la investigación.

No se enviaron correos comerciales durante esta preparación. Instantly permanece pausado: conexión y prueba interna Gmail documentadas en `INSTANTLY_GMAIL_CONNECTION_20261019.md`; recepción de respuestas en Unibox pendiente de certificar. No se conecta Gmail personal ni se guardan contraseñas.
