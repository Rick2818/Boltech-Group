---
type: runbook
title: Protección de seguimientos comerciales
status: proposed
---

# Protección de seguimientos comerciales

La instrucción de AGENTS exige aviso previo y evidencia antes de integrar. El workflow Followup Safety Gate ejecuta el control en cada PR y push a main, sin credenciales de producción ni llamadas de red de las pruebas. No se añade calendario, agente ni emisor. USD0.

## Antes de editar

Ejecutar `node scripts/quality/followup_safety_gate.mjs --preflight`. Inventariar quién escribe Leads y RSI Agent Work. No asumir que una reserva Redis de este trabajador protege escrituras de otros procesos en Airtable. Definir qué etapas y exclusiones deben conservarse.

## Antes de integrar

Ejecutar `node scripts/quality/followup_safety_gate.mjs --self-test`. El control negativo usa el commit 891e875 en una carpeta scratch y debe reproducir exactamente tres fallos de seguridad por aserciones, no por importaciones rotas. Después el código corregido debe pasar sus regresiones e integración. Un exit distinto de cero significa NO APROBADO. Las pruebas usan config/qa_case.json y sustitutos locales; el preload impide fetch externo.

## Decisión de reparación

La proyección de recibos ya no escribe Status, Evidence, Notes, Commercial Stage ni Next Action en Airtable. Las escrituras compartidas no tienen una condición de versión común a todos sus escritores. La alternativa segura es conservar recibos inmutables en Redis con SET NX y lectura posterior, observar Work sin modificarlo y exponer RECONCILE_REQUIRED. crmSynced permanece false. No presentar esto como actualización automática del estado individual.

Los seguimientos elegibles conservan su ruta y autorización existentes, reservas y conciliación sin reenvío. Exclusiones se leen antes de recuperar y otra vez antes de enviar. Los recibos históricos no rebajan etapas. Esta reparación acota las escrituras del trabajador; otros módulos mantienen sus propios riesgos y requieren revisión separada.

Para restablecer una proyección automática sobre campos compartidos se necesita un mecanismo de escritura coordinado adoptado por TODOS los escritores, o un modelo de proyecciones separado con consumidores adaptados. No basta añadir un lock usado solo por este adaptador. La conciliación debe revisar el recibo existente sin enviar de nuevo.

## Integración y producción

El workflow solo puede impedir integrar si GitHub exige el check `followup-safety` en la regla de main y se controla el bypass. No se ha configurado ni verificado esa regla desde esta entrega. Un aviso de AGENTS depende de que el agente lo siga; no es un hook bloqueante instalado.

Preparar PR revisable y esperar validación remota. Antes de publicar, revisar esta limitación funcional de proyección y el despliegue exacto. Producción exige comprobación posterior del ciclo existente y de sus recibos sin forzar contactos ni pagos.

No declarar listo, seguro en todos los escenarios, actualizado en producción ni primer pago por un resultado local verde.
