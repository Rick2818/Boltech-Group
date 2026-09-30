import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const output = resolve(root, 'artifacts/improvement-cycle');
const groups = [
  { name: 'A2A intake contracts', files: ['tests/test_a2a_intake.mjs'] },
  { name: 'Partner Network', files: ['tests/test_partner_network.mjs'] },
  { name: 'Operational truth', files: ['tests/test_operational_truth_guards.mjs'] },
  { name: 'Payment security', files: ['tests/test_payment_security_v2.mjs', 'tests/test_payment_rsi_hardening.mjs', 'tests/test_billing_sentinel.mjs'] },
  { name: 'MCP authentication', files: ['tests/test_mcp_remote_auth.mjs', 'tests/test_mcp_remote_handshake.mjs'] },
];

function run(files) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, ['--test', ...files], { cwd: root, env: { ...process.env, NODE_OPTIONS: '' } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => resolveRun({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on('close', code => resolveRun({ exitCode: code ?? 1, stdout, stderr }));
  });
}

function count(tap, key) {
  const match = tap.match(new RegExp(`^ℹ ${key} (\\d+)$`, 'm'));
  return match ? Number(match[1]) : null;
}

await mkdir(output, { recursive: true });
const results = [];
for (const group of groups) {
  const start = performance.now();
  const result = await run(group.files);
  const index = results.length + 1;
  const log = `group-${index}.log`;
  await writeFile(resolve(output, log), `${result.stdout}\n${result.stderr}`);
  results.push({
    group: group.name,
    files: group.files,
    passed: result.exitCode === 0,
    exitCode: result.exitCode,
    tests: count(result.stdout, 'tests'),
    failures: count(result.stdout, 'fail'),
    durationMs: Math.round(performance.now() - start),
    log,
  });
}

const passed = results.every(result => result.passed);
const report = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || null,
  status: passed ? 'PASS' : 'FAIL',
  scope: 'Local automated regression tests; not a production health or revenue claim',
  results,
  nextAction: passed
    ? 'Review the proposed change and its measured acceptance criteria before merging.'
    : 'Inspect the failing group logs, correct the cause, and rerun the same checks.',
};
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const summary = [
  '## Boltech improvement cycle',
  '',
  `Commit: ${report.commit || 'local run'} · Result: **${report.status}**`,
  '',
  '| Area | Result | Tests | Failures | Log |',
  '|---|---|---:|---:|---|',
  ...results.map(r => `| ${r.group} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.tests ?? '—'} | ${r.failures ?? '—'} | ${r.log} |`),
  '',
  report.nextAction,
  '',
  'This measures regression checks only. Operational outcomes require separate provider evidence.',
].join('\n') + '\n';
await writeFile(resolve(output, 'summary.md'), summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
console.log(summary);
process.exitCode = passed ? 0 : 1;
