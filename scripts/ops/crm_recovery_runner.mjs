import { mkdir, writeFile } from 'node:fs/promises';
const token = process.env.PARTNER_API_TOKEN;
if (!token) throw new Error('Administrative credential is missing');
const base = 'https://boltech-group.vercel.app';
const response = await fetch(`${base}/api/crm?action=recovery`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(55000) });
let data;
try { data = await response.json(); } catch { throw new Error('CRM recovery response is invalid'); }
if (!response.ok || data.success !== true || !Array.isArray(data.results)) throw new Error(`CRM recovery failed: HTTP ${response.status}`);
const report = { timestamp: new Date().toISOString(), commit: process.env.GITHUB_SHA || null, results: data.results, recovery: data.recovery, status: data.recovery?.blocked > 0 ? 'ATTENTION' : 'PASS' };
await mkdir('ops-output', { recursive: true });
await writeFile('ops-output/crm-recovery.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
