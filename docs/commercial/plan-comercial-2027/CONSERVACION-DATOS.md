# Plazo de conservación de datos — APROBADO POR EL PROPIETARIO
> **Nota interna:** este texto lo prepara el agente como apoyo operativo. **No es asesoría
> legal** y no certifica cumplimiento de ninguna norma. Aprobado por el propietario el 2026-11-05;
> no hubo revisión legal externa y el propietario asumió el riesgo (ver `docs/APROBACIONES.md`).

Estado: `APPROVED_BY_OWNER` · Aprobado: 2026-11-05 · Revisión legal externa: no (riesgo asumido)

---

## 1. Regla general

Cada dato se guarda **solo mientras sirve para el fin por el que se recogió**, y se borra al
vencer el plazo. La hoja privada tiene una columna obligatoria: **fecha de borrado prevista**.

---

## 2. Plazos propuestos

| Categoría | Qué contiene | Plazo | Qué pasa al vencer |
|---|---|---|---|
| Solicitud recibida, sin respuesta nuestra | Formulario enviado | 30 días | Se borra si no hubo respuesta; si la hubo, pasa a la siguiente fila |
| Solicitud respondida, sin avance | Correo enviado, sin propuesta | 12 meses desde el último contacto | Se borra |
| Evaluación en curso | Alcance en discusión | 12 meses desde el último contacto | Se borra o se pide consentimiento nuevo |
| Propuesta enviada, no ganada | Propuesta y notas | 18 meses desde el envío | Se borra |
| Cliente con contrato vigente | Datos de la relación | Duración del contrato + [PLAZO LEGAL APLICABLE, PENDIENTE] | Se borra o se anonimiza |
| Constancia de retiro de consentimiento | Fecha, correo y hecho del retiro | 12 meses | Se borra |
| Registros técnicos (fecha de envío, página de origen) | Metadatos del formulario | 90 días | Se borran |

**Criterio de reinicio:** cada contacto real del interesado reinicia el plazo de su fila. La
inactividad no.

---

## 3. Cómo se aplica en la práctica

1. Al registrar una solicitud se calcula y escribe la fecha de borrado prevista.
2. Una vez al trimestre se revisan las filas vencidas y se borran.
3. El borrado se anota en una línea del registro: fecha, cantidad de filas y quién lo hizo.
4. No se guardan copias ocultas ni respaldos con datos vencidos. Si existe respaldo, se rota en
   el mismo plazo.

---

## 4. Excepciones

Se conserva lo estrictamente necesario, y solo eso, cuando:

- Una norma aplicable exige conservarlo.
- Hay un contrato vigente que lo requiere.
- Hay un reclamo o litigio en curso.

En cada excepción se anota el motivo y la fecha en que se revisará de nuevo.

---

## 5. Qué no se guarda nunca

- Presupuesto, teléfono, tamaño de empresa o plazo: no se piden en el formulario.
- Datos de menores de 18 años.
- Credenciales, tokens o claves en la hoja o en el repositorio.
- Datos de personas que retiraron el consentimiento, salvo la constancia del retiro.

---

## 6. Situación actual

| Elemento | Estado |
|---|---|
| Destino | Hoja de cálculo privada, acceso solo de Ricardo |
| Retención automática | **No implementada**: hoy el borrado es manual y trimestral |
| Registro de borrados | **No existe todavía** |
| Respaldo | **No definido** |

Mientras la retención sea manual, el riesgo es olvidar el borrado. La primera mejora, cuando haya
volumen, es una alerta mensual con las filas vencidas.

---

## 7. Checklist antes de publicar

- [ ] Confirmar el plazo legal aplicable a clientes con contrato
- [ ] Crear la columna "fecha de borrado prevista" en la hoja
- [ ] Definir el respaldo y su rotación
- [ ] Aprobar los plazos de la tabla
- [ ] Publicar el resumen en [URL DE CONSERVACIÓN]
- [ ] Quitar esta nota interna antes de publicar
