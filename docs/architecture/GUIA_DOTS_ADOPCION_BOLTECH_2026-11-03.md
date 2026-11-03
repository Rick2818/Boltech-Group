# Adopción funcional de la guía ChatGPT Dots para empezar a delegar

**Boltech Group · 2026-11-03.** Referencia: Academia de IA, guía ChatGPT Dots para empezar a delegar, revisada el 2026-10-02. Este cambio **no** clona un producto oficial Dots, código ni activos gráficos de terceros.

## Qué se incorpora y qué no

| Patrón de delegación | Boltech hoy | Cambio realizado | Pendiente para afirmar paridad |
| --- | --- | --- | --- |
| Encargo con resultado y fuentes | Objetivos autenticados, planes y aprobación en Redis | Brief estructurado con resultado, fuentes, canal preferido e instrucciones de revisión | Ejecutor real para consultar fuentes declaradas |
| Continuidad entre sesiones | Persistencia por tenant y CAS | Operación de progreso con historial reciente y último recibo | Reanudación autónoma real después de cerrar chat |
| Historial y evidencia | Eventos y recibos en Leo | Resumen consultable por propietario | Tablero UI y validación productiva |
| Voz | Componentes de audio existentes | Preferencia de canal (chat o voice) informativa | Demostrar manos libres y conversación bidireccional |
| Correo, archivos y calendario | Integraciones existentes sujetas a permisos | Fuente informativa sin conectar automáticamente credenciales | OAuth de cliente y pruebas autorizadas |
| Recurrencia | Supabase Cron de Agente 1 y Mercadeo | Estado explícito NOT_CONFIGURED; sin nuevo cron | Programación por cliente, recibos y control de consentimientos |

## Contrato de API

Ruta POST /api/leo-objectives con Authorization: Bearer <token emitido por un servicio de aprovisionamiento confiable>. El visitante de la web no debe crear su propio tenant token.

Solicitud de creación ilustrativa (dato sintético, no cliente real):

~~~json
{
  "operation": "create",
  "objective": {
    "id": "encargo-demo-001",
    "description": "Analizar problemas de soporte sin contactar a terceros",
    "criteria": "Entregar resumen con fuentes, riesgos y próximos pasos",
    "source": "customer",
    "delegation": {
      "expectedResult": "Un reporte de incidencias y recomendaciones verificables",
      "sources": ["FAQ autorizadas", "Exportación CRM autorizada"],
      "reviewInstructions": "Solicitar aprobación antes de cambiar datos o enviar comunicaciones",
      "preferredChannel": "chat"
    }
  }
}
~~~

Consulta de progreso:

~~~json
{"operation":"progress","id":"encargo-demo-001"}
~~~

El resultado contiene status, version, updatedAt, plannedSteps, lastReceipt, delegation y recentActivity. Los estados sourceStatus=REFERENCES_ONLY, scheduleStatus=NOT_CONFIGURED y notificationStatus=NOT_CONFIGURED **no** equivalen a integraciones activas. preferredChannel=voice solo declara una preferencia; no demuestra telefonía.

## Preservación operacional

1. Identidad verificada por tenant, aprobaciones, CAS, herramientas de solo lectura y recibos permanecen vigentes.
2. Agente 1 sigue investigando únicamente Upwork y Freelancer.com. No se habilitan bids, Connects, cold email ni mensajes externos.
3. No se modifican Mercadeo, Wompi, cobros, clientes, precios o infraestructura de producción.
4. No se añaden cron, dependencias ni servicios pagados. Presupuesto incremental del cambio: USD 0.
5. Ningún ejemplo sintético constituye actividad comercial real o caso de éxito. Las fuentes declaradas **no** se han consultado automáticamente.

## Gates antes de fusionar/desplegar

~~~bash
node --test tests/test_leo_delegation_brief.mjs tests/test_leo_tenant_autonomy.mjs tests/test_leo_objective_http_e2e.mjs
node scripts/quality/check_server_syntax.mjs
npm run improve:check
~~~

Revisar Governance y CI sobre el commit exacto, y verificar HTTP real en Vercel preview con autenticación no expuesta. El merge no debe presentarse como prueba de autonomía de Dots oficial, programación de tareas o integración de fuentes.
