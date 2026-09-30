# Boltech Agent Referral Exchange (BARE) — Diseño operativo v1

Fecha: 2026-09-28

## Objetivo

Crear un puente de solicitudes entre agentes para convertir relaciones de partner en pipeline real. El diseño no comparte listas completas de clientes. Intercambia **Need Cards**: descripciones estructuradas de una necesidad comercial, con atribución, consentimiento y trazabilidad.

## Qué copiamos de plataformas que ya monetizan partnerships

1. **Deal registration (PartnerStack):** una oportunidad se registra antes de trabajarla para evitar conflictos de atribución.
2. **Lead passing / co-selling (PartnerStack/Microsoft):** una oportunidad puede ser trabajada por el originador, por Boltech o conjuntamente.
3. **Account overlap (Crossbeam):** se prioriza una oportunidad cuando existe una relación previa o una ruta de introducción.
4. **Consent gate (AWS):** los datos sensibles del cliente no deben circular antes de que exista autorización.
5. **A2A standard:** descubrimiento mediante Agent Card y comunicación estructurada entre agentes.

## Arquitectura Boltech

Partner Agent
→ descubre https://boltech-group.vercel.app/.well-known/agent-card.json
→ envía una Need Card autenticada a /api/a2a
→ Boltech valida partner y datos
→ registra Referral en Airtable
→ mantiene PII enmascarada si no hay consentimiento
→ calcula matches por capability + market + language
→ devuelve Referral ID + partners candidatos
→ humano/owner aprueba introducción cuando corresponda
→ co-selling
→ WON/LOST
→ cash collection
→ Commission Ledger
→ payout real

## Need Card v1

El mensaje A2A debe incluir una parte de datos JSON:

{
  "type": "boltech.referral.need.v1",
  "serviceType": "WhatsApp Agent",
  "needSummary": "Empresa recibe 250 consultas diarias y el equipo tarda horas en responder.",
  "market": "El Salvador",
  "language": "Spanish",
  "budgetUsd": 3000,
  "urgency": "TODAY",
  "clientConsent": false
}

### Regla de privacidad

Con clientConsent=false:
- no enviar nombre de la empresa cliente;
- no enviar nombre de contacto;
- no enviar correo, teléfono ni otra PII;
- Boltech puede registrar y hacer matching por necesidad, mercado, idioma y presupuesto.

Con clientConsent=true:
- el partner puede incluir datos del cliente;
- el referral queda trazado y atribuido.

## Estados

NEW / REVIEW / ACCEPTED / WAITING_CONSENT / QUALIFIED / PROPOSAL / NEGOTIATION / WON / LOST / REJECTED.

WON no genera comisión automáticamente.

La comisión nace únicamente cuando existe un pago real registrado en Commission Ledger.

## Seguridad

- Agent Card público: no contiene secretos.
- POST A2A: autenticado.
- Cada partner aprobado tiene una credencial independiente; su SHA-256 se compara con `A2A Key Hash` y exige `ACTIVE` y `A2A Enabled`.
- No hay fallback a tokens maestros.
- Upstash Redis REST conserva la reserva atómica y el resultado de cada mensaje; sin ese almacenamiento, el intake falla cerrado.
- Airtable sigue siendo sistema de registro.

## Diferenciador Boltech

El exchange no es una base de leads ni una lista vendida. Es un **mercado de necesidades verificables**:

Need → Match → Consent → Warm handoff → Co-sell → Cash → Commission.

El dato valioso no es el email del cliente. Es saber:
- qué necesita;
- cuánto urge;
- qué capacidad hace falta;
- qué partner puede abrir la puerta o entregar la solución;
- quién originó la oportunidad;
- cuánto efectivo terminó cobrándose.

## Fase de lanzamiento

Fase 1 — hoy:
- publicar Agent Card;
- desplegar endpoint A2A;
- registrar campos de matching;
- verificar que el endpoint rechaza acceso no autenticado;
- documentar protocolo.

Fase 2 — primer partner aprobado:
- emitir credencial A2A separada;
- marcar A2A Enabled;
- ejecutar primer intercambio real con PII enmascarada;
- validar atribución y audit trail.

Fase 3:
- partner-specific credentials;
- warm-intro requests;
- partner acceptance/rejection;
- webhooks;
- overlap hashes para comparar cuentas sin compartir CRM bruto;
- reputación por conversiones reales y tiempo de respuesta.

## Métricas

- Need Cards recibidas
- Requests con consentimiento
- Matches encontrados
- Intro requests aceptadas
- Conversaciones comerciales
- Propuestas
- WON
- Cash collected
- Commission earned / paid
- Time-to-first-response
- Conversion rate por partner

Nunca se contabilizan simulaciones como resultados comerciales.

## Contrato de registro y reintentos — 2026-09-30

`SendMessage` requiere `params.message.messageId` (string no vacío, máximo 120), `role: "ROLE_USER"` y `parts` array con una Need Card. `clientConsent` debe ser un boolean JSON; cadenas como `"false"` se rechazan. La identidad originadora siempre proviene del Bearer, nunca de la tarjeta.

La respuesta v1 contiene `result.task`. El cliente conserva el mismo `messageId`, la tarjeta y el `contextId` al reintentar. Un duplicado completado devuelve el resultado original sin nuevas escrituras; contenido distinto con el mismo ID devuelve conflicto. `GetTask` con `params.id` recupera el resultado solo para el partner autenticado.

Requiere `AIRTABLE_TOKEN` (o `AIRTABLE_PAT`), `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` como secretos de runtime. No guardar valores en Git. La reserva Redis no expira deliberadamente: una operación interrumpida no puede volver a escribir un referral. Un estado incompleto exige revisar el `A2A Task ID` en Referrals y Partner Activities antes de reconciliarlo; nunca borrar reservas ni crear un ID nuevo para forzar un retry. Redis debe conservarse y no sufrir eviction; perder el ledger elimina esa protección.

El registro no entrega clientes a otros agentes ni confirma una venta. El matching exige capacidad compatible; candidatos PROSPECT siguen requiriendo aprobación. Los resúmenes y notas libres deben excluir PII no autorizada.

Prueba local: `npm run test:a2a`. Son contratos aislados con fixtures de prueba, sin escrituras en producción y sin contabilizar actividad comercial. La prueba real entre un partner aprobado y el despliegue vigente sigue siendo una verificación separada.
