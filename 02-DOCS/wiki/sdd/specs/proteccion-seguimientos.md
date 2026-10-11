---
type: specification
title: Protección de seguimientos
---

# Criterios de aceptación

1. QA, bajas y exclusiones impiden recuperación mutable, llamadas de envío y cambios de tarea.
2. Recibos históricos y actualizaciones simultáneas no sobrescriben etapas, responsables o evidencia compartida.
3. Recibos quedan durables y se leen de vuelta; fallas de almacenamiento previo impiden enviar. Un envío confirmado nunca se repite por fallar Work.
4. La integración ejecuta el trabajador y adaptador reales con los servicios sustituidos y solo config/qa_case.json.
5. La puerta rechaza el baseline defectuoso por las tres aserciones esperadas y acepta la versión corregida; no hay fetch externo.
6. AGENTS exige aviso y verificación; CI ejecuta el check sin calendario ni secretos. Distinguir instrucción, check ejecutado y regla de rama requerida.
7. Declarar explícitamente que la proyección automática Airtable queda pendiente; no afirmar crmSynced verdadero por almacenar Redis.

Alcance autorizado: reparación reversible y prevención. No efectuar contactos, cobros, cambios en main compartido ni nuevos agentes o servicios. La aceptación local no certifica producción. La configuración requerida de GitHub es una aceptación externa pendiente hasta verificarla.
