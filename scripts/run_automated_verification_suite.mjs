/**
 * =============================================================================
 * MASTER SUITE RUNNER: VERIFICACIÓN AUTOMATIZADA DE AGENTES BOLTECH GROUP
 * =============================================================================
 * Ejecuta la batería de pruebas fiduciarias y genera el reporte forense.
 * =============================================================================
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SUITES = [
  { name: 'A2A intake contracts', cmd: 'node', args: ['--test', 'tests/test_a2a_intake.mjs'], category: 'A2A privacy and retry safety' },
  {
    name: '1. Garantías Enterprise & Aislamiento Multi-Tenant',
    cmd: 'node',
    args: ['--test', 'tests/test_agent_enterprise_guarantee.mjs'],
    category: 'Arquitectura & Seguridad'
  },
  {
    name: '2. Escáner Perimetral & Blindaje Defensivo',
    cmd: 'node',
    args: ['--test', 'tests/test_header_scanner.mjs'],
    category: 'Ciberdefensa Perimetral'
  },
  {
    name: '3. Hardening Anti-XSS & Sanitización de Payloads',
    cmd: 'node',
    args: ['--test', 'tests/test_scanner_shield_hardening.mjs'],
    category: 'Integridad de Datos'
  },
  {
    name: '4. Integridad Bilingüe i18n (English / Spanish)',
    cmd: 'node',
    args: ['--test', 'tests/test_i18n_integrity.mjs'],
    category: 'Experiencia & Idioma'
  },
  {
    name: '5. Centinela Financiero & Matrices de Cobro Fiduciario',
    cmd: 'node',
    args: ['--test', 'tests/test_billing_sentinel.mjs'],
    category: 'Unit Economics & Pagos'
  },
  {
    name: '6. Rieles de Liquidación Strike Lightning (rick2818@strike.me)',
    cmd: 'node',
    args: ['--test', 'tests/test_no_broken_strike_urls.mjs'],
    category: 'Liquidación Soberana'
  },
  {
    name: '7. Servidor MCP Boltech Payments (Strike / Wompi / Stripe)',
    cmd: 'node',
    args: ['--test', 'tests/test_boltech_payments_mcp.mjs'],
    category: 'MCP Protocol & Herramientas'
  },
  {
    name: '8. Auditoría del Stack Base de SDKs Fiduciarios',
    cmd: 'node',
    args: ['tests/test_all_sdks_audit.mjs'],
    category: 'SDKs & Runtime'
  },
  {
    name: '9. Partner Network — Consentimiento, Referrals y Comisiones',
    cmd: 'node',
    args: ['--test', 'tests/test_partner_network.mjs'],
    category: 'Partner Ecosystem & Revenue'
  },
  {
    name: '10. Veracidad Operacional — Cero Simulación y Evidencia Real',
    cmd: 'node',
    args: ['--test', 'tests/test_operational_truth_guards.mjs'],
    category: 'Gobernanza & Evidencia'
  }
];

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const proc = spawn(cmd, args, { cwd: ROOT_DIR, shell: false });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({
        code,
        success: code === 0,
        stdout,
        stderr,
        durationMs
      });
    });
  });
}

async function main() {
  console.log('🏛️ =========================================================================');
  console.log('🛡️  BOLTECH GROUP — SUITE DE VERIFICACIÓN AUTOMATIZADA DE AGENTES B2B');
  console.log('🏛️ =========================================================================\n');
  console.log(`⏰ Timestamp de Ejecución: ${new Date().toISOString()}`);
  console.log(`📍 Entorno: Node.js ${process.version} | Plataforma: ${process.platform}\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const results = [];

  for (const suite of SUITES) {
    process.stdout.write(`⏳ Ejecutando ${suite.name}... `);
    const res = await runCommand(suite.cmd, suite.args);

    if (res.success) {
      totalPassed++;
      console.log(`✅ [APROBADO] (${res.durationMs}ms)`);
      results.push({ ...suite, status: 'PASSED', durationMs: res.durationMs });
    } else {
      totalFailed++;
      console.log(`❌ [FALLIDO] (${res.durationMs}ms)`);
      console.error(`   Detalle de error:\n${res.stderr || res.stdout}\n`);
      results.push({ ...suite, status: 'FAILED', durationMs: res.durationMs, error: res.stderr || res.stdout });
    }
  }

  console.log('\n📊 =========================================================================');
  console.log('📋 RESUMEN EJECUTIVO DE CONTROL DE CALIDAD');
  console.log('📊 =========================================================================');
  console.log(`• Total de Suites Evaluadas: ${SUITES.length}`);
  console.log(`• Suites Aprobadas (Verde):  ${totalPassed}`);
  console.log(`• Suites Fallidas:           ${totalFailed}`);
  console.log(`• Tasa de Éxito Fiduciario:  ${((totalPassed / SUITES.length) * 100).toFixed(1)}%`);

  const reportPath = path.join(ROOT_DIR, 'pipeline', 'reporte_verificacion_automatizada.json');
  try {
    const reportData = {
      timestamp: new Date().toISOString(),
      platform: 'Boltech Group / Unblock AI Shield',
      success: totalFailed === 0,
      totalSuites: SUITES.length,
      passedCount: totalPassed,
      failedCount: totalFailed,
      details: results
    };
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`\n💾 Reporte forense guardado en: pipeline/reporte_verificacion_automatizada.json`);
  } catch (e) {}

  if (totalFailed > 0) {
    console.log('\n❌ [ALERTA FIDUCIARIA]: Se detectaron fallas en la verificación. Revisar logs.');
    process.exit(1);
  } else {
    console.log('\n💎 [CERTIFICACIÓN OK]: Todos los agentes y subsistemas cumplen con los estándares fiduciarios.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('FATAL SUITE ERROR:', err);
  process.exit(1);
});
