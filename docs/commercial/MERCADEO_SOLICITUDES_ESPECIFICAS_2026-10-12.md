# Solicitudes específicas y gestión de apoyos existentes

Se conserva marketing-director, las colas, firmas por rol, n8n y los tres RSI. Sin gasto, nuevos emisores ni programación.

Una solicitud específica conserva supportRequest: kind, need, deliverable, evidenceRefs. Los tipos permitidos son SUPPLIER_FIT, MESSAGE_AND_FIT, WRITTEN_DIAGNOSIS_AND_DEMONSTRATION y SCOPE_VALUE_AND_OBJECTIONS. need/deliverable anteriores también se convierten automáticamente en contexto. El material vincula necesidad y entregable; no declara hechos de cliente ni aplica precio universal.

marketing-revise modifica únicamente un evento existente propiedad del RSI firmado. Exige materialFingerprint vigente y supportRequest completo. Conserva material anterior y aceptación en materialHistory; reinicia revisión vigente. Un material ya utilizado es inmutable. La corrección no crea eventos ni reenvía mensajes.

marketing-manage registra decisión idempotente con responsable y causa. El ciclo existente MARKETING gestiona hasta 20 pendientes; no crea otra automatización. Estados: NEEDS_SPECIFIC_BRIEF, NEEDS_SALES_REVIEW, WAITING_QUALIFIED_REPLY, WAITING_CUSTOMER_REPLY, CONTACT_HOLD y READY_FOR_AUTHORIZED_SALES_DECISION. Este último no autoriza envío: el emisor mantiene sus controles.

Gestión prevista de los cuatro pendientes, sujeta a lectura productiva actualizada:
- Tres eventos adk-support-RSI-01/02/03-2026-10-07: completar contexto por rol con el registro CRM existente; RSI-01 valida encaje e investigación; RSI-02/03 esperan respuesta y calificación. No contactar por generar material.
- marketing-leadflow-RSI01-20261009: corregir a SUPPLIER_FIT, preguntas sobre contratación por proyecto, financiación, herramientas/plazo y portafolio externo. Mantener espera de respuesta al correo ya enviado.
- El apoyo A y L ya utilizado se conserva sin modificaciones.

Pruebas: tests/test_marketing_specific_requests.mjs usa únicamente config/qa_case.json en memoria. Publicación y gestión real se verifican por separado; no presentar pruebas como actividad comercial.

## Evidencia de entrega local

10 pruebas usan el único caso QA en memoria. Sintaxis de los siete módulos y git diff --check comprobados. Se consultó en producción la cola MARKETING: siguen los cuatro eventos esperados. La preparación de su corrección se ejecutó en modo lectura (applied=false, sendingPerformed=false). No se modificaron los eventos productivos.

Publicación bloqueada: GitHub respondió user rejected MCP tool call al crear un blob. La rama remota se creó, pero no se publicó commit ni PR ni despliegue. No se intentó eludir el rechazo. Queda pendiente publicar y después ejecutar una vez el script con --apply, conciliar sus recibos y leer de nuevo los cuatro eventos. El apoyo A y L ya usado se excluye expresamente de esa operación.

## Resolución del bloqueo de publicación

12 octubre: la conexión GitHub aceptó create_blob con contenido UTF-8 legible. Las solicitudes anteriores con contenido base64 habían sido rechazadas sin diagnóstico detallado. Esto confirma escritura disponible y una vía aceptada para publicar; no demuestra la causa interna del rechazo. Se continúa la publicación mediante contenido UTF-8 y comprobación de la referencia remota.
