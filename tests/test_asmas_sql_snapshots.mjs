import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../asmas/migrations/',import.meta.url);
const sql=(name)=>readFileSync(new URL(name,root),'utf8');
test('versioned A4 SQL snapshots include seven functions, tables and access restrictions',()=>{
 const fun=sql('20261014_director_functions_snapshot.sql');
 const handoff=sql('20261014_director_handoff_snapshot.sql');
 const tables=sql('20261014_director_tables_snapshot.sql');
 for(const name of ['director_assign','director_coordinate','director_rsi_audit','director_rsi_classify','director_rsi_evaluate','director_rsi_retry_decision']){
  assert.match(fun,new RegExp('FUNCTION asmas\\.'+name+'\\('));
 }
 assert.match(handoff,/FUNCTION asmas\.simple_finish\(/);
 assert.match(handoff,/director_mode/);
 for(const name of ['director_decisions','director_incidents'])assert.match(tables,new RegExp('table if not exists asmas\\.'+name));
 assert.match(tables,/enable row level security/i);
 assert.match(tables,/revoke all/i);
 assert.doesNotMatch(fun+handoff+tables,/GOOGLE_API_KEY\s*=|X-ASMAS-Worker-Token\s*=/i);
});
