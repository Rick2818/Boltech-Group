# QA integrado: Agente 1 → Agente 2 → Agente 3

Autorización: Ricardo, 18 octubre 2026. Objetivo: probar consumidores reales, no solo crear registros de traspaso. Un caso sintético, almacenamiento local durable, mensaje simulado y aprobación QA firmada; cero proveedores/productos/pagos reales. Se reutilizan ADK, createRsiExecutor, createCommercialRelay, createHandoffStore y createRsi03Closing.register.

La identidad original conserva Name=Cliente Sintético y Data Quality=QA. Se verifica que el relay productivo la rechace. Solo el adaptador local presenta una proyección contractual de comprador `buyer@boltech.invalid`, claramente etiquetada QA_ISOLATED_PROJECTION; no se alteran guardas productivas ni se escribe en CRM/Redis reales. La proyección permite probar los consumidores sin convertir el cliente sintético en una oportunidad comercial.

El runner inicia un proceso nuevo sin credenciales, bloquea red/UDP/DNS/subprocesos y admite seis fases: RSI-01, RSI-02-HOLD, DIRECTORA, RSI-02-TRANSFER, RSI-03, VERIFY. Cada fase deja recibo con hash enlazado; una segunda ejecución recupera el recibo sin repetir trabajo. Dirección firma exclusivamente con clave local QA. La comprobación de gateway es un adaptador simulado necesario para registrar el caso en el código de cierre; no acredita Wompi conectado. No se ejecuta cierre, cotización externa, cobro ni entrega de cliente.

Aceptación: A1 publica una entrega; A2 la acepta y espera aprobación; firma manipulada se rechaza; A2 con aprobación publica al A3; A3 consume y registra un único caso; ambos handoffs terminan COMPLETED, cada uno con eventos PENDING/ACCEPTED/COMPLETED. Los cuatro ciclos de agente usan el código real en procesos separados; estados y herramientas externas son adaptadores QA.

Rollback: retirar runner de pruebas/CI y estos archivos. La campaña de cinco prospectos y sus registros no se modifican. Alcance de certificación: integración aislada de ejecutores y contratos de traspaso, no transporte Gmail/Redis/Airtable/Vercel productivo ni respuesta autónoma de compradores reales.
