import fs from 'fs';
import path from 'path';

/**
 * Motor de Cadencias B2B Desatendidas de Boltech Group
 * Objetivo: Cubrir los $3,000 USD/mes ($100 USD/día) con ventas éticas y 100% legales.
 */

export const CAMPAIGNS = {
  CYBERSECURITY_DEFENSE_AUDIT: {
    id: 'cybersecurity_defense_audit',
    name: 'Centinela Autónomo 24/7 & Blindaje Operativo Continuo',
    offer: 'Centinela 24/7 ($69 USD/mes) / Auditoría Inicial ($19 USD)',
    strikeAddress: 'rick2818@strike.me',
    cadence: [
      {
        impact: 1,
        day: 1,
        subject_es: (companyName, domain) => `Optimización Operativa & Blindaje Continuo 24/7 para ${domain || companyName}`,
        subject_en: (companyName, domain) => `Continuous 24/7 Operations & Security Hardening for ${domain || companyName}`,
        body_es: (companyName, domain = '') => `Estimado equipo directivo en ${companyName},

Le saluda el equipo de ingeniería de Boltech Group (firma especializada en automatización operativa y vigilancia continua 24/7 sobre Google Antigravity & Vercel Cloud).

Analizamos el flujo de su portal ${domain || companyName}. Detectamos ineficiencias de configuración y riesgos de disponibilidad que pueden resolverse con un operador de software permanente sin incrementar su nómina.

🎬 Demostración Ejecutiva (70s):
https://boltech-group.vercel.app/?domain=${domain || ''}

Nuestra propuesta fiduciaria de valor permanente (Los 5 Anclajes de Confianza):
1. Cero Invasión Previa: No solicitamos contraseñas, claves API ni acceso a bases de datos. Todo opera de forma no invasiva desde la nube.
2. Centinela 24/7 ($69 USD/mes): Monitoreo continuo cada 15 minutos, supervisión de despliegues y auto-remediación perimetral sin contratar personal adicional.
3. Garantía Fiduciaria Incondicional de 7 Días: Si en los primeros 7 días el sistema no le ahorra al menos 10 horas de trabajo manual, reembolsamos el 100% de su pago.
4. Privacidad Bancaria SOC-2: Procesamiento 100% en memoria volátil RAM; ninguna conversación ni dato toca disco.
5. Matemática de ROI Objetivo: Un operador o analista cuesta $600+ USD/mes; nuestro agente opera 24/7 por solo $2.30 USD al día ($69 USD/mes), pagándose solo desde la primera semana.

Verifique su plataforma en vivo y active su Centinela 24/7:
🔗 https://boltech-group.vercel.app/?domain=${domain || ''}

Liquidación fiduciaria instantánea en El Salvador vía:
⚡ Strike Lightning (0% comisión): rick2818@strike.me
🏦 Wompi SV (Banco Agrícola)

Atentamente,
Dirección de Soluciones Autónomas — Boltech Group`,
        body_en: (companyName, domain = '') => `Dear Leadership Team at ${companyName},

This is the engineering team at Boltech Group / Unblock AI (autonomous operations & 24/7 continuous cloud infrastructure).

We analyzed the operational perimeter of ${domain || companyName} and detected bottlenecks and hardening gaps that can be managed autonomously 24/7 without adding payroll overhead.

🎬 70s Executive Briefing:
https://boltech-group.vercel.app/?lang=en&domain=${domain || ''}

Our 5 Fiduciary Trust Anchors:
1. Zero Invasive Access: We never ask for passwords or database credentials. Everything runs externally.
2. 24/7 Continuous Sentinel ($69 USD/mo): Non-stop perimeter monitoring every 15 min, deployment protection, and real-time alerts.
3. 7-Day Unconditional Guarantee: 100% money-back refund if it does not save your team at least 10 hours of manual work in week one.
4. SOC-2 Banking Privacy: Zero disk retention; 100% processed in volatile RAM.
5. Objective ROI: A human operator costs $600+ USD/mo; our autonomous agent operates 24/7 for just $2.30 USD/day ($69 USD/mo).

Explore live diagnostics and activate continuous coverage:
🔗 https://boltech-group.vercel.app/?lang=en&domain=${domain || ''}

Direct zero-fee settlement via Strike Lightning: rick2818@strike.me

Best regards,
Autonomous Solutions Division — Boltech Group`
      },
      {
        impact: 2,
        day: 3,
        subject_es: (companyName, domain) => `🎬 Demostración en 70s: Operación Continua & Centinela 24/7 para ${domain || companyName}`,
        subject_en: (companyName, domain) => `🎬 70s Video Briefing: 24/7 Continuous Sentinel for ${domain || companyName}`,
        body_es: (companyName, domain = '') => `Estimado equipo directivo en ${companyName},

Le escribo en seguimiento a nuestra propuesta de optimización. Preparamos un Video Briefing Ejecutivo de 70 segundos donde mostramos cómo opera nuestro Centinela Autónomo 24/7 protegiendo y acelerando su infraestructura:

▶️ VER DEMOSTRACIÓN EJECUTIVA (70 Segundos):
🔗 https://boltech-group.vercel.app/?domain=${domain || ''}

Puntos clave de la solución permanente para ${companyName}:
• Vigilancia Perimetral Continua: Verificación automática cada 15 minutos sin intervención de su equipo.
• Reducción de Costes Operativos: Ahorro de $600+ USD/mes en horas de personal técnico.
• Centinela 24/7 ($69 USD/mes): Monitoreo y auto-remediación permanente por $2.30 USD/día.
• Garantía Fiduciaria Total (7 Días): Si en 7 días no ahorra al menos 10 horas de trabajo operativo, le reembolsamos el 100% sin preguntas.

Active la cobertura continua de su portal:
🔗 https://boltech-group.vercel.app/?domain=${domain || ''}

Liquidación directa en El Salvador vía Strike Lightning: rick2818@strike.me o Wompi SV.

Atentamente,
Dirección de Soluciones Autónomas — Boltech Group`,
        body_en: (companyName, domain = '') => `Dear Executive Team at ${companyName},

Following up on our operations alert, we recorded a 70-Second Executive Video Briefing showing how our 24/7 Autonomous Sentinel monitors, protects, and optimizes cloud platforms without human toil:

▶️ WATCH 70s EXECUTIVE BRIEFING:
🔗 https://boltech-group.vercel.app/?lang=en&domain=${domain || ''}

Key takeaways for ${companyName}:
• Continuous Perimeter Protection: Automated checks every 15 minutes.
• Operational Cost Reduction: Saves $600+ USD/month in technical overhead.
• 24/7 Autonomous Sentinel ($69 USD/mo): Non-stop coverage for $2.30 USD/day.
• 100% 7-Day Fiduciary Guarantee: Full refund if it does not save your team at least 10 hours in week one.

Activate continuous coverage for your platform:
🔗 https://boltech-group.vercel.app/?lang=en&domain=${domain || ''}

Direct settlement via Strike Lightning: rick2818@strike.me

Best regards,
Autonomous Solutions Division — Boltech Group`
      },
      {
        impact: 3,
        day: 5,
        subject_es: (companyName, domain) => `Cierre de período de evaluación para ${domain || companyName}: Cobertura 24/7`,
        subject_en: (companyName, domain) => `Evaluation window closing for ${domain || companyName}: 24/7 Coverage`,
        body_es: (companyName, domain = '') => `Estimado equipo directivo en ${companyName},

Hoy cerramos el ciclo de evaluación técnica para ${domain || companyName}.

Si desean asegurar la disponibilidad de sus pasarelas y automatizar la vigilancia perimetral 24/7 con garantía de 7 días:

1. Ingrese a la consola fiduciaria y vea el video de 70s:
   🔗 https://boltech-group.vercel.app/?domain=${domain || ''}
2. Active el Centinela Autónomo 24/7 ($69 USD/mes con garantía incondicional).
3. O solicite un Agente de Automatización Operativa a medida.

Liquidación instantánea vía Strike Lightning: rick2818@strike.me o Wompi SV.

Equipo de Operaciones — Boltech Group`,
        body_en: (companyName, domain = '') => `Dear Executive Team at ${companyName},

We are concluding the evaluation review window for ${domain || companyName}.

If you wish to secure your infrastructure and automate 24/7 continuous monitoring with a 7-day money-back guarantee:

1. Open the console and watch the 70s walkthrough:
   🔗 https://boltech-group.vercel.app/?lang=en&domain=${domain || ''}
2. Activate the 24/7 Autonomous Sentinel ($69 USD/month with 7-day guarantee).
3. Or request a custom Autonomous Operations Agent.

Instant zero-fee Lightning settlement: rick2818@strike.me

Operations Team — Boltech Group`
      }
    ]
  },
  AUTONOMOUS_OPERATOR_SAAS: {
    id: 'autonomous_operator_saas',
    name: 'Agente Autónomo B2B Desatendido',
    offer: 'Licencia Pro Operator ($69 USD/mes) / Suite Élite ($249 USD/mes)',
    strikeAddress: 'rick2818@strike.me',
    cadence: [
      {
        impact: 1,
        day: 1,
        subject_es: (companyName) => `Elimina 40 horas de trabajo operativo repetitivo cada semana en ${companyName}`,
        subject_en: (companyName) => `Eliminate 40 hours of repetitive operational tasks each week at ${companyName}`,
        body_es: (companyName, domain = '') => `Hola equipo en ${companyName},

¿Cuánto tiempo dedica su personal a cobranza manual, responder consultas idénticas por WhatsApp y conciliar transacciones?

Boltech Group implementa un agente soberano en 60 segundos que asume esas tareas en piloto automático 24/7, permitiendo a sus directivos enfocarse en ventas de alto valor.

🎬 Video Demostración (70s):
https://unblock-shield.vercel.app/?domain=${domain || ''}

Inicia tu prueba y activa tu agente por $69 USD/mes:
🔗 https://unblock-shield.vercel.app/?plan=pro&domain=${domain || ''}

Liquidación instantánea vía Strike Lightning: rick2818@strike.me

Atentamente,
Boltech Group`,
        body_en: (companyName, domain = '') => `Hello team at ${companyName},

How much time does your staff waste on manual payment collection, repetitive WhatsApp inquiries, and bank reconciliation?

Unblock AI deploys an autonomous sovereign agent in 60 seconds that handles those workflows 24/7, freeing your executives to focus strictly on revenue growth.

🎬 70s Executive Video Briefing:
https://unblock-shield.vercel.app/?lang=en&domain=${domain || ''}

Launch and activate your agent for $69 USD/month:
🔗 https://unblock-shield.vercel.app/?lang=en&plan=pro&domain=${domain || ''}

Direct settlement via Strike Lightning: rick2818@strike.me

Best regards,
Unblock AI`
      }
    ]
  }
};

export function renderCampaignMessage(campaignId, impactIndex, companyName, lang = 'es', domain = '') {
  const camp = CAMPAIGNS[campaignId];
  if (!camp) throw new Error(`Campaña no encontrada: ${campaignId}`);
  const item = camp.cadence.find(c => c.impact === impactIndex) || camp.cadence[0];

  const subjectFn = lang === 'en' ? item.subject_en : item.subject_es;
  const bodyFn = lang === 'en' ? item.body_en : item.body_es;

  const subject = typeof subjectFn === 'function' ? subjectFn(companyName, domain) : subjectFn;
  const body = typeof bodyFn === 'function' ? bodyFn(companyName, domain) : bodyFn;

  return {
    campaign: camp.name,
    offer: camp.offer,
    impact: item.impact,
    day: item.day,
    subject,
    body,
    strikePaymentAddress: camp.strikeAddress
  };
}
