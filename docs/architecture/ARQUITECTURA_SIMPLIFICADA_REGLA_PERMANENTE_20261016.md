# Regla de Oro — Arquitectura Simplificada
Fecha: 2026-10-16. Estado: norma obligatoria para nuevos proyectos y cambios significativos; no constituye despliegue ni certificación de funcionalidades.

## Mandato
Antes de iniciar cualquier proyecto, consultar y aplicar esta arquitectura. Objetivo: maximizar resultados de negocio con mínima complejidad operativa, sin sacrificar seguridad, cumplimiento o integridad de datos.

1. Definir primero el flujo mínimo verificable de punta a punta y su indicador de negocio; en Boltech, prioridad: primer cobro real.
2. Preferir una aplicación modular y un coordinador/ejecutor central, manteniendo roles lógicos y agentes existentes cuando aporten valor. No crear agentes o ejecutores duplicados.
3. Usar una fuente de verdad principal para estados operativos; integrar registros externos por adaptadores y conciliación. Preferir infraestructura ya contratada.
4. Usar un pipeline CI claro con pruebas proporcionales al riesgo: unitarias, integración, seguridad, E2E y comprobación productiva cuando corresponda. No confundir simulaciones o deploy READY con certificación.
5. Diagnosticar bloqueos con RSI centralizado, registrar causa, etapa, responsable, intentos y recibos; reintentar solo con idempotencia y conciliación ante estados inciertos.
6. Autorizar solo integraciones necesarias con acceso real y costos aprobados; no contratar servicios pagados sin permiso expreso.
7. Operar en nube cuando se requiera autonomía, con monitoreo sencillo, alarmas y recuperaciones seguras; no depender de la laptop.
8. Preservar Wompi, comunicaciones, datos y servicios productivos. No reiniciar Boltech desde cero. Migrar por etapas tras inventario y pruebas; no repetir cobros ni envíos inciertos.

## Puerta de inicio obligatoria (registro del Harness)
Antes de escribir código: (a) objetivo medible; (b) flujo mínimo; (c) diagrama y responsables; (d) componentes e integraciones estrictamente necesarios; (e) presupuesto y permisos; (f) riesgos y protección de datos; (g) pruebas y criterios de aceptación; (h) rollback. Cualquier desviación de la arquitectura debe justificarse por escrito y aprobarse cuando implique costo, exposición o cambio irreversible.

## Criterios de cumplimiento
Menos piezas y duplicaciones, mismo o mejor resultado, trazabilidad, costo controlado y pruebas con evidencia. Las excepciones razonadas son posibles; la simplicidad no elimina controles críticos. Documento de política, no prueba de migración o producción.

Aplicar conjuntamente con AGENTS.md, HARNESS_WORKFLOW.md, COMMERCIAL_HARNESS.md y reglas comerciales existentes. Prevalecen instrucciones superiores, seguridad y autorizaciones.
