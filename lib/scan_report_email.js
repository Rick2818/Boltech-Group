// Construye el correo del diagnóstico usando ÚNICAMENTE resultados reales del escáner.
// No contiene hallazgos fijos ni afirmaciones que el escáner no pueda comprobar.

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ICON = { ok: '✓', warn: '⚠', fail: '✗' };
const COLOR = { ok: '#34d399', warn: '#fbbf24', fail: '#fb7185' };
const SEVERITY_LABEL = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export function buildScanEmail({ domain, email, scan }) {
  const when = new Date(scan.scannedAt).toUTCString();
  const issues = scan.checks.filter((c) => c.status !== 'ok');
  const hasIssues = issues.length > 0;

  const scope =
    'Alcance: este análisis lee únicamente lo que su servidor responde públicamente a una petición HTTPS (cabeceras de seguridad y datos básicos del certificado TLS), ' +
    'ejecutada desde nuestros servidores en la fecha indicada. No es una prueba de intrusión ni evalúa vulnerabilidades de la aplicación, y los resultados pueden variar según la región, el CDN o los filtros anti-bots.';

  const footerNote =
    `Recibiste este correo porque alguien solicitó el diagnóstico de ${domain} con esta dirección (${email}). Si no fuiste tú, puedes ignorarlo.`;

  const subject = `[Diagnóstico de cabeceras] ${domain}: calificación ${scan.grade} (${scan.score}/100)`;

  // ---------------- TEXTO PLANO ----------------
  const lines = [];
  lines.push('BOLTECH GROUP — DIAGNÓSTICO DE CABECERAS DE SEGURIDAD');
  lines.push(`Dominio analizado: ${domain}${scan.finalHost && scan.finalHost !== domain ? ` (redirige a ${scan.finalHost})` : ''}`);
  lines.push(`Fecha del análisis: ${when}`);
  lines.push(`Calificación: ${scan.grade} (${scan.score}/100) — ${scan.summary.passed} correctas, ${scan.summary.warned} por mejorar, ${scan.summary.failed} faltantes`);
  lines.push('');
  lines.push('RESULTADOS:');
  for (const c of scan.checks) {
    const sev = c.severity ? ` [Severidad ${SEVERITY_LABEL[c.severity]}]` : '';
    lines.push(`${ICON[c.status]} ${c.label}${sev}`);
    lines.push(`   ${c.detail}`);
  }
  if (scan.tls) {
    lines.push('');
    lines.push(`Certificado TLS: ${scan.tls.protocol || 'n/d'}${scan.tls.issuer ? `, emitido por ${scan.tls.issuer}` : ''}${scan.tls.daysLeft != null ? `, vence en ${scan.tls.daysLeft} día(s)` : ''}`);
  }
  if (scan.caveats.length) {
    lines.push('');
    lines.push('NOTAS:');
    scan.caveats.forEach((n) => lines.push(`- ${n}`));
  }
  if (scan.patches) {
    lines.push('');
    lines.push('PARCHE SUGERIDO (solo lo que faltó) — NGINX:');
    lines.push(scan.patches.nginx);
    lines.push('');
    lines.push('PARCHE SUGERIDO — VERCEL (vercel.json):');
    lines.push(scan.patches.vercel);
    lines.push('');
    lines.push('Versiones para Apache y Cloudflare disponibles en el informe en pantalla: https://unblock-shield.vercel.app');
  } else {
    lines.push('');
    lines.push('No detectamos cabeceras faltantes en esta revisión. ¡Buen trabajo!');
  }
  lines.push('');
  lines.push(scope);
  if (hasIssues) {
    lines.push('');
    lines.push('¿Quieres que lo apliquemos por ti? Responde a este correo o escribe a ricardo.boltechai@gmail.com');
  }
  lines.push('');
  lines.push(footerNote);
  const text = lines.join('\n');

  // ---------------- HTML ----------------
  const rows = scan.checks.map((c) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;vertical-align:top;color:${COLOR[c.status]};font-weight:700;width:24px;">${ICON[c.status]}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;font-size:13px;line-height:1.5;">
          <strong>${esc(c.label)}</strong>${c.severity ? ` <span style="color:${COLOR[c.status]};font-size:11px;">· Severidad ${SEVERITY_LABEL[c.severity]}</span>` : ''}<br>
          <span style="color:#94a3b8;">${esc(c.detail)}</span>
        </td>
      </tr>`).join('');

  const caveatsHtml = scan.caveats.length
    ? `<div style="background:#1e293b;border-left:4px solid #fbbf24;padding:12px 16px;border-radius:6px;margin:18px 0;color:#cbd5e1;font-size:12px;line-height:1.5;">
        <strong style="color:#fbbf24;">Notas:</strong><br>${scan.caveats.map((n) => `• ${esc(n)}`).join('<br>')}
       </div>`
    : '';

  const pre = (label, code) => `
      <p style="margin:16px 0 6px;color:#e2e8f0;font-size:13px;font-weight:700;">${esc(label)}</p>
      <pre style="background:#030712;border:1px solid #334155;border-radius:8px;padding:14px;font-family:'Courier New',monospace;font-size:12px;color:#38bdf8;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0;">${esc(code)}</pre>`;

  const patchHtml = scan.patches
    ? `<h3 style="color:#f8fafc;font-size:15px;margin:28px 0 4px;">Parche sugerido (solo lo que faltó)</h3>
       ${pre('Nginx', scan.patches.nginx)}
       ${pre('Vercel (vercel.json)', scan.patches.vercel)}
       <p style="color:#94a3b8;font-size:12px;margin-top:10px;">Las versiones para Apache y Cloudflare están en el informe en pantalla.</p>`
    : `<p style="color:#34d399;font-size:14px;margin:24px 0;">No detectamos cabeceras faltantes en esta revisión. ¡Buen trabajo!</p>`;

  const ctaHtml = hasIssues
    ? `<div style="text-align:center;margin:28px 0 8px;">
         <a href="mailto:ricardo.boltechai@gmail.com" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">¿Lo aplicamos por ti? Escríbenos →</a>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <div style="max-width:680px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:14px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#0284c7 0%,#0369a1 100%);padding:28px 32px;">
      <p style="margin:0;color:#bae6fd;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.15em;">Boltech Group · Diagnóstico de cabeceras de seguridad</p>
      <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff;">${esc(domain)}</h1>
    </div>
    <div style="padding:28px 32px;">
      <p style="margin:0 0 6px;color:#e2e8f0;font-size:15px;">
        Calificación: <strong style="font-size:20px;">${esc(scan.grade)}</strong> <span style="color:#94a3b8;">(${scan.score}/100)</span>
      </p>
      <p style="margin:0 0 18px;color:#94a3b8;font-size:12px;">
        ${scan.summary.passed} correctas · ${scan.summary.warned} por mejorar · ${scan.summary.failed} faltantes · Analizado el ${esc(when)}
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #1e293b;border-radius:8px;border-collapse:separate;">${rows}
      </table>
      ${caveatsHtml}
      ${patchHtml}
      ${ctaHtml}
      <p style="color:#64748b;font-size:11px;line-height:1.5;margin:24px 0 0;">${esc(scope)}</p>
    </div>
    <div style="background:#020617;padding:18px 24px;text-align:center;border-top:1px solid #1e293b;color:#64748b;font-size:11px;line-height:1.5;">
      ${esc(footerNote)}<br>Boltech Group
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

