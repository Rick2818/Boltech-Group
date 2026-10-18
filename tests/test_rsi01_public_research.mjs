import test from 'node:test';import assert from 'node:assert/strict';import {safeCompanySite,investigatePublicSite,discoverCompanyPages} from '../lib/rsi01_public_research.js';
test('blocks private and unrelated endpoints',()=>{assert.equal(safeCompanySite('https://127.0.0.1','a@example.com'),null);assert.equal(safeCompanySite('http://example.com','a@example.com'),null);assert.equal(safeCompanySite('https://evil.com','a@example.com'),null)});
test('observes public title without inventing approval',async()=>{const r=await investigatePublicSite({fields:{'Company URL':'https://example.com','Contact Email':'a@example.com'}},{fetcher:async()=>({ok:true,headers:{get:()=> 'text/html'},text:async()=>'<title>Example Company</title>'})});assert.equal(r.state,'PUBLIC_WEBSITE_OBSERVED');assert.equal(r.needConfirmed,false);assert.equal(r.approvalGranted,false)});

test('autonomous discovery stays on official host and records source without inferring need',async()=>{
 const links='<title>Metal Fab</title><a href="/get-a-quote/">Quote</a><a href="/contact">Contact</a><a href="https://outsider.example/contact">offsite</a>';
 const seen=[];
 const fetcher=async url=>{seen.push(url);return {ok:true,headers:{get:()=> 'text/html'},text:async()=>url.endsWith('/get-a-quote/')?'<title>Quote</title>Request a quote. Upload your drawing.':links}};
 const lead={fields:{'Company URL':'https://example.com','Contact Email':'sales@example.com'}};
 const out=await investigatePublicSite(lead,{fetcher});
 assert.equal(out.pagesInspected,3);assert.ok(out.operationalSignals.some(s=>s.type==='QUOTE_INTAKE'&&s.sourceUrl==='https://example.com/get-a-quote/'));
 assert.ok(seen.every(x=>x.startsWith('https://example.com/')));assert.equal(out.needConfirmed,false);assert.equal(out.approvalGranted,false);
 assert.deepEqual(discoverCompanyPages(links,'https://example.com/'),['https://example.com/contact','https://example.com/get-a-quote/']);
});
test('large builder metadata does not hide the official title and published contact',async()=>{
 const out=await investigatePublicSite({fields:{'Company URL':'https://example.com','Contact Email':'sales@example.com'}},{fetcher:async()=>({ok:true,headers:{get:()=> 'text/html'},text:async()=>'<script>'+('x'.repeat(110000))+'</script><title>Company</title>Request a quote <a href="mailto:sales@example.com">Sales</a>'})});
 assert.equal(out.state,'PUBLIC_WEBSITE_OBSERVED');assert.equal(out.contactEvidence.length,1);assert.equal(out.operationalSignals[0].type,'QUOTE_INTAKE');
});
