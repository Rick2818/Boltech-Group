# Agente 1: exactamente cinco contactos completos

Autorización: Ricardo, 18 octubre 2026: corregir autonomía de búsqueda y completar cinco, no contabilizar inventario revisado. Objetivo: paquete diario de cinco empresas diferentes con contacto público verificable, fuente oficial, señal de proceso, comprobación MX, exclusiones CRM/historial Gmail/Apollo y mensaje individual. Una señal pública es una hipótesis; no se requiere fingir una necesidad confirmada para preparar una consulta inicial.

Un coordinador existente y Redis conservan selección diaria y recibos. Preparación incremental antes de las 09:00 SV en el workflow existente. Máximo cinco seleccionados; candidatos rechazados se sustituyen hasta agotar fuentes/plazo. Si faltan, estado BLOCKED con causa; nunca COMPLETED. Fuente inicial: empresas existentes no contactadas del CRM. Apollo se consulta sin créditos para excluir contactos guardados que requieren revisión; no se declara historial Apollo completo para esas cuentas. No se compra enriquecimiento. La cobertura no garantiza encontrar cinco válidos ni demanda real.

Aprobación de preparación por política acotada de Ricardo; no simula aprobación humana caso por caso. Reutiliza SDR y sus controles de horario, historial y envío incierto. Preparar no envía. Correos MX y publicación oficial no garantizan buzón ni entrega. Los bloqueos de investigación permanecen visibles y no se convierten en ventas.

Aceptación: cinco paquetes íntegros o bloqueo explícito; cinco empresas distintas; error externo no se interpreta CLEAR; lectura posterior del CRM antes de contar; reintento sin duplicados; límite exacto cinco; no tocar pagos. Rollback: revertir el cambio, conservar ledgers y recibos, no reenviar trabajos inciertos.

Preparación a las 08:30/08:45 y ejecución 09:00 SV reutilizan el mismo workflow y ledger. Una campaña previa sin intentos puede reanudarse tras completar la cola; UNKNOWN o efectos previos siguen retenidos. Lote inicial del 18 octubre: cinco empresas nuevas localizadas de forma asistida, verificadas en sus páginas oficiales e ingresadas como RESEARCH_ONLY. La preparación autónoma debe validarlas desde producción. La incorporación de nuevas empresas más allá del inventario disponible todavía depende de fuentes accesibles; no certificar reposición diaria ilimitada.

Pruebas: 26 comprobaciones focalizadas y 25 de regresión aprobadas localmente, más sintaxis. QA corrige idempotencia entre fechas y bloquea UDP/DNS y variables de entorno fuera de lista permitida.
