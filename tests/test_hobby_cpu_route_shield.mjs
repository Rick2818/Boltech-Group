import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
const samples = [
  ['/api/lead',{}],['/api/partners',{action:'metrics'}],['/api/crm',{}],
  ['/api/a2a',{}],['/api/ai',{}],['/api/intel',{}],['/api/scan',{}],
  ['/api/telegram',{}],['/api/whatsapp',{}],['/api/cron/master-dispatcher',{}],
  ['/api/agent1-autonomous-inbox',{}],['/api/marketing-sales-cycle',{}],
  ['/api/upwork/callback',{}],['/api/marketing-login',{}],['/api/mcp',{}],
  ['/api/index',{marketing_sales_cycle:'1'}],
  ['/api/index',{mcp:'1'}],
  ['/api',{agent1_cycle:'1'}],
  ['/api/index',{specialist_chat:'1'}],
  ['/api/index',{telegram:'1'}]
];
const safe = [
  ['/api/payments',{}],['/api/payments',{action:'wompi-webhook'}],
  ['/api/catalog',{}],['/api/index',{catalog:'1'}],
  ['/api/index',{leo_sales:'1'}],['/api',{leo_sales:'1'}],
  ['/api/index',{leo_objectives:'1'}],
  ['/api/index',{rodrigo_speech:'1'}],
  ['/api/leo-autonomy-worker',{}],['/api/leo-objectives',{}],
  ['/api/leo-channels',{}],['/api/leo-meta-whatsapp',{}],
  ['/sales-agent.html',{}],['/index.html',{}]
];

function matched(path,query) {
  return (cfg.routes||[]).filter(rule => new RegExp(rule.src).test(path) &&
    (!rule.has || rule.has.every(h=>h.type==='query' && Object.hasOwn(query,h.key))));
}

test('all removed commercial and specialized routes are blocked by Vercel routing before Node.js',()=>{
  assert.equal(cfg.crons.length,0);
  for(const [path,query] of samples){
    const rules=matched(path,query);
    assert.ok(rules.length>=1, 'retired route escaped edge: '+path+' '+JSON.stringify(query));
    assert.ok(rules.every(rule=>rule.status===410 && !rule.dest && rule.headers?.['cache-control']==='no-store'),
      'retired route not direct edge HTTP 410: '+path);
  }
});

test('Leo and Wompi routes never match the retirement rules',()=>{
  for(const [path,query] of safe)assert.equal(matched(path,query).length,0,
    'critical route must remain reachable: '+path+' '+JSON.stringify(query));
  assert.equal(cfg.rewrites.some(r=>r.source==='/api/catalog'&&r.destination==='/api/index?catalog=1'),true);
  for(const route of ['/api/leo-objectives','/api/leo-channels','/api/leo-meta-whatsapp','/api/leo-autonomy-worker']){
    assert.ok(cfg.rewrites.some(r=>r.source===route),'Leo rewrite absent: '+route);
  }
});

test('old query flags are guarded by edge rules in both normalized and unnormalized index paths',()=>{
  for(const key of ['agent1_cycle','marketing_sales_cycle','mcp','upwork_oauth','specialist_chat']){
    for(const path of ['/api','/api/index']){
      assert.ok(matched(path,{[key]:'1'}).length>=1,'edge did not shield '+key+' '+path);
    }
  }
});
