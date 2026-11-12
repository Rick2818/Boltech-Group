# Leo — expediente comercial con aprobación del propietario

Endpoint: `/api/leo-commerce` en Cloudflare Pages. Requiere sesión de propietario válida de Leo, HTTPS y el almacenamiento `COMMERCE` existente.

## Recorrido real interno

1. `create`: crea una oportunidad identificada por UUID, empresa, contacto y necesidad. Rechaza registros marcados como `synthetic`.
2. `qualify`: registra presupuesto, plazo y persona que decide.
3. `proposal`: guarda el alcance, las exclusiones y el importe en centavos USD como borrador. No se envía.
4. `approve`: aprobación explícita por el propietario autenticado. No es aceptación del comprador.
5. `followup`: registra una nota interna o un contacto manual con evidencia, sin enviar ningún mensaje. El panel web restringe esto a borradores.
6. `close`: registra oportunidad perdida, o aceptación del comprador sustentada por la referencia de evidencia proporcionada por el propietario. `CLOSED_WON_REPORTED` **no** equivale a cobro verificado.

Los expedientes se cifran al guardarse y se leen con permisos del propietario. La versión debe coincidir para cada actualización. El usuario puede recuperar un expediente por ID desde el panel privado en `/sales-agent`.

## Lo que no está acreditado

- No hay envío automático en Upwork, Explee, Freelancer, WhatsApp ni correo.
- No se integra todavía la conversación pública de Leo a la creación automática de expedientes. La calificación del panel es una operación humana autenticada.
- No se procesa ni verifica un cobro; Wompi no cambia.
- El almacenamiento KV es eventualmente consistente y no ofrece compare-and-swap: las escrituras concurrentes pueden sobrescribirse. No utilizar la API como contabilidad transaccional ni para múltiples operadores simultáneos.
- Una referencia de evidencia escrita por un propietario no verifica por sí sola la identidad del comprador, la autenticidad documental ni la recepción de un mensaje.
- No permite introducir registros ficticios como ventas reales; las pruebas usan almacenamiento aislado.

## Comprobación

```bash
node --test tests/test_leo_commerce.mjs
python3 scripts/pages_ci.py build
node --check .cloudflare/pages-release/_worker.js
```

La publicación de `main` requiere CI satisfactoria, despliegue correcto y verificación del endpoint con sesión de propietario. No declarar funcionamiento productivo únicamente por haber fusionado el PR.
