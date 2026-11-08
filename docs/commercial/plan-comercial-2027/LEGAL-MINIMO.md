# Paquete legal mínimo — BORRADOR

> **Aviso:** este documento lo prepara el agente como apoyo operativo. **No es asesoría
> legal** y no certifica cumplimiento de ninguna norma. Los textos son borradores que deben
> ser aprobados por el propietario o por un profesional antes de publicarse.

Fecha: 2026-11-05 · Estado: `DRAFT_PARTIALLY_APPROVED` (3 decisiones tomadas el 2026-11-05; textos siguen en borrador)

---

## 1. Qué necesita el plan antes de captar datos reales

| # | Pieza | Estado | Responsable |
|---|---|---|---|
| 1 | Aviso de privacidad publicado | Borrador abajo | Ricardo aprueba |
| 2 | Texto de consentimiento en el formulario | Ya existe en config (`form.legalFields`) | Ricardo aprueba |
| 3 | Términos del servicio | Borrador de estructura | Ricardo aprueba |
| 4 | Política de retención y borrado | Por definir | Ricardo decide |
| 5 | Destino de los datos (dónde caen las solicitudes) | **No definido** | Ricardo decide |
| 6 | Base legal para contactar | **No definida** | Ricardo decide |
| 7 | Encargado de tratamiento (si hay terceros) | **No definido** | Ricardo decide |

Sin los puntos 5, 6 y 7 no se puede recibir una solicitud real de forma responsable.

---

## 2. Borrador — Aviso de privacidad (estructura)

1. **Quién trata los datos**: Boltech Group, con datos de contacto pendientes.
2. **Qué datos se recogen**: nombre, apellido, correo, empresa, cargo y resultado esperado.
3. **Para qué**: responder la solicitud y evaluar el alcance del servicio.
4. **Base legal**: consentimiento del interesado (pendiente de confirmar).
5. **Con quién se comparten**: pendiente de definir (CRM, correo, hosting).
6. **Cuánto se conservan**: pendiente de definir.
7. **Derechos**: acceso, corrección, borrado y retiro del consentimiento, con un canal de contacto.
8. **Fecha de última actualización**.

---

## 3. Borrador — Texto de consentimiento (ya integrado en el formulario)

> "Autorizo que me contacten por este medio."

Checklist del consentimiento:
- [x] Casilla separada, no premarcada.
- [x] Obligatoria para enviar.
- [x] Se registra junto con la solicitud (`consentToContact`).
- [ ] Enlaza al aviso de privacidad (falta URL).
- [ ] Explica cómo retirarlo (falta).

---

## 4. Borrador — Términos del servicio (estructura)

1. **Alcance**: implementación, agente a medida o soporte, definidos por escrito.
2. **Precio**: cotización según alcance; no hay precio publicado.
3. **Pagos**: condiciones por acordar; el piloto se divide en dos pagos.
4. **Criterio de aceptación**: escrito antes de empezar.
5. **Límites**: no se garantizan resultados; se entrega lo acordado y medible.
6. **Propiedad intelectual**: el cliente recibe lo entregado; el método queda del proveedor.
7. **Confidencialidad y datos**: pendiente de redactar.
8. **Cancelación**: pendiente de redactar.

---

## 5. Reglas de claims (auditadas por el agente)

Prohibido en cualquier pieza:
- Clientes, logos o testimonios sin consentimiento escrito.
- Cifras de resultados sin fuente propia verificable.
- "El mejor", "garantizado", "líder del mercado".
- Certificaciones que no se posean (SOC 2, ISO, GDPR compliance).
- Comparaciones con terceros sin enlace y fecha.

---

## 6. Qué hace el agente y qué no

| Puede | No puede |
|---|---|
| Redactar y mantener estos borradores | Dar asesoría legal |
| Auditar claims y consentimiento | Certificar cumplimiento |
| Marcar vacíos y blockear publicación | Asumir responsabilidad legal |
| Verificar que no se pidan datos innecesarios | Decidir la base legal |

**Criterio de salida:** el plan pasa de `APPROVED_BY_OWNER` a `APPROVED` solo con
la aprobación explícita de Ricardo o de un profesional contratado.

---

## 7. Decisiones tomadas el 2026-11-05

Las tres decisiones que bloqueaban la captura ya están tomadas por el propietario:

| # | Decisión | Elección |
|---|---|---|
| 5 | Destino de los datos | Hoja de cálculo privada, acceso solo de Ricardo |
| 6 | Base legal para contactar | Consentimiento explícito, casilla obligatoria del formulario |
| 7 | Encargado de tratamiento | Solo Ricardo; sin terceros |

**Aprobado el 2026-11-05:** los tres textos están aprobados por el propietario, sin revisión
legal externa. El riesgo asumido está registrado en `docs/APROBACIONES.md`. **Lo que sigue
pendiente:** publicar el aviso en una URL estable, operar el canal de retiro en el buzón real y
crear la columna de fecha de borrado. Hasta entonces no se publica ni se reciben datos reales.

**Lo que no cambia:** este documento sigue sin ser asesoría legal y el agente no certifica
cumplimiento.

---

## 8. Textos redactados el 2026-11-05

Los tres textos que faltaban ya están redactados como borradores, en español e inglés:

| Texto | Archivo | Estado |
|---|---|---|
| Aviso de privacidad completo | `docs/AVISO-PRIVACIDAD.md` | `APPROVED_BY_OWNER` |
| Retiro del consentimiento | `docs/RETIRO-CONSENTIMIENTO.md` | `APPROVED_BY_OWNER` |
| Plazo de conservación | `docs/CONSERVACION-DATOS.md` | `APPROVED_BY_OWNER` |

Cada uno trae su checklist de publicación y deja entre corchetes los datos que solo puede
completar el propietario: razón social, domicilio, correo de privacidad y URLs.

**Siguen bloqueando la captura real:** que el aviso esté **aprobado y publicado en una URL
estable**, que exista el **canal de retiro** operativo y que los **plazos estén aprobados**.
Un texto aprobado no sustituye a un texto publicado.
