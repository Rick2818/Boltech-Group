import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));
test('daily campaign and recovery use canonical inbox instead of a second Airtable campaign',()=>{
 assert.deepEqual(config.crons,[{path:'/api/agent1-autonomous-inbox?scheduled_campaign=1',schedule:'0 15 * * *'}]);
 const sql=readFileSync(new URL('../scripts/ops/commercial_scheduler.sql',import.meta.url),'utf8');
 assert.match(sql,/agent1-autonomous-inbox/);
 assert.equal(existsSync(new URL('../.github/workflows/asmas_rsi01_9am.yml',import.meta.url)),false);
});
