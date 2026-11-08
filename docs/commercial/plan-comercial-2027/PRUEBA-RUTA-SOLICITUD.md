# Prueba de la ruta de solicitud con datos sintéticos

Fecha: 2026-11-05 · Estado: `PASSED` · Entorno: local, sin red, sin credenciales, sin envío.
Datos: **100% sintéticos** (`provenance: synthetic`). Ningún dato de persona real.

---

## Qué se probó

La ruta completa de una solicitud, desde la ficha publicada hasta la métrica:

```
submission.json → commercial-capture → registro persistido → commercial-metrics → métricas
```

Directorio de estado aislado: `C:\Temp\opencode\synthetic-route` (fuera del repositorio, para no
mezclar la prueba con datos del proyecto).

---

## Defecto encontrado y corregido

La primera ejecución **falló**:

```
INVALID_COMMERCIAL_INPUT: Asset does not belong to selected playbook
```

Causa: las tres fichas de `commercial/operaciones/` usaban los identificadores
`operaciones-pedidos`, `operaciones-facturas` y `operaciones-stock`, pero esos activos no estaban
registrados en el catálogo comercial. La ficha se podía leer, pero la solicitud no se podía
registrar.

Corrección aplicada:

- `config/commercial-playbooks.json` ahora declara los tres activos en `operationsAssets`.
- `src/commercial.mjs` expone `operationsAssets(config)` y los acepta en `captureCommercial`.
- El kit generado sigue en **22 piezas** (los activos de operaciones se mantienen aparte).
- Nueva prueba automática: las tres fichas son capturables al dar consentimiento.

---

## Resultado de la captura

| Ficha | Resultado | Etapa | Acción siguiente | Enviado |
|---|---|---|---|---|
| `operaciones-pedidos` | OK | `CAPTURED` | `HUMAN_WRITTEN_QUALIFICATION` | No |
| `operaciones-facturas` | OK | `CAPTURED` | `HUMAN_WRITTEN_QUALIFICATION` | No |
| `operaciones-stock` | OK | `CAPTURED` | `HUMAN_WRITTEN_QUALIFICATION` | No |

Las tres entraron por `demo_request`, con `provenance: synthetic` y sin envío externo.

**Control negativo:** con `consent: false` la misma ruta se rechaza (`Explicit contact consent is
required`). Esto está cubierto por prueba automática.

---

## Métricas por tenant (`boltech`)

`node src/cli.mjs commercial-metrics --tenant boltech`

| Recorrido | Oportunidades reales | Sintéticas excluidas | Cualificadas | Propuestas | Ganadas | Ingresos verificados |
|---|---|---|---|---|---|---|
| `adoption-services` | 0 | 0 | 0 | 0 | 0 | `{}` |
| `solution-led` | 0 | **3** | 0 | 0 | 0 | `{}` |

Conversiones: `captureToQualified = null`, `captureToWon = null`.
Visitas y tasa visita→solicitud: `null`.

**Lectura correcta de este resultado:** la ruta funciona, pero **no hay negocio medido**. Las tres
solicitudes son sintéticas y el código las excluye del negocio real, tal como está diseñado.
Cualquier cifra distinta de cero aquí sería inventada.

---

## Métricas generales (capa de diagnóstico)

`node src/cli.mjs metrics`

| Indicador | Valor |
|---|---|
| Oportunidades registradas | 3 (todas sintéticas) |
| Por etapa | `CAPTURED: 3`, resto 0 |
| Por canal | `demo_request: 3` |
| `captureToQualified` | 0 |
| Ingresos verificados | `{}` |

No disponibles, declarados por el propio sistema: `operatingCosts`,
`externalA2ADeliveries`, `realCustomers`.

---

## Qué queda probado y qué no

**Probado:**
- La ficha de solicitud es un contrato válido para el registro.
- El consentimiento es obligatorio y se verifica.
- La procedencia sintética se excluye del negocio real.
- La etiqueta de atribución (`playbookId`, `assetId`) sobrevive a la captura.
- El siguiente paso siempre es cualificación humana por escrito, nunca un envío.

**No probado (y no se puede probar todavía):**
- Recepción de una solicitud real: falta destino de datos, base legal y encargado.
- Medición de visitas: falta conector web aprobado.
- Envío de cualquier tipo: `externalSendEnabled: false`.

---

## Cómo reproducirlo

```powershell
$state = "C:\Temp\opencode\synthetic-route"
$env:CLONADOR_STATE_DIR = $state
node src/cli.mjs commercial-capture --file <ficha>.ready.json
node src/cli.mjs commercial-metrics --tenant boltech
node src/cli.mjs metrics
```

Las fichas `.ready.json` se derivan de las publicadas cambiando `consent` a `true` y un
`requestId` único. No se versionan: son datos de prueba desechables.
