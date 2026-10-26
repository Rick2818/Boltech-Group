import { readFile, writeFile } from 'node:fs/promises';
import { planLeadIntake } from '../../lib/lead_intake.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw Error('Usage: node scripts/ops/plan_lead_intake.mjs snapshot.json plan.json');
}

const snapshot = JSON.parse(await readFile(input, 'utf8'));
const result = planLeadIntake(snapshot.leads, snapshot.work, new Date().toISOString());
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  reviewed: result.reviewed,
  newTasks: result.create.length,
  covered: result.covered.length,
  excluded: result.excluded.length,
  sendingPerformed: false,
}));
