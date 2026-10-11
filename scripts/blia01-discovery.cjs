#!/usr/bin/env node
/**
 * BLIA-01 autonomous discovery runner (research-only).
 * Public Google News RSS is used as a discovery source, NOT proof of buying intent.
 * No emails, CRM writes, payments, or synthetic leads are generated.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const QUERIES = [
  {market:'US', query:'("request for proposal" OR "seeking vendors") ("customer support automation" OR "AI chatbot")'},
  {market:'US', query:'("looking for" OR "seeking") ("AI automation partner" OR "workflow automation") business'},
  {market:'Mexico', query:'("licitación" OR "buscamos proveedor") ("automatización" OR "chatbot") empresa'},
  {market:'Colombia', query:'("convocatoria" OR "buscamos proveedor") ("automatización" OR "inteligencia artificial") empresa'}
];
const MAX_ITEMS = Math.min(40, Math.max(1, Number(process.env.BLIA_MAX_ITEMS || 20)));
const TIMEOUT_MS = 12000;
const MAX_AGE_DAYS = 14;
const now = new Date();

function unescapeXml(s='') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));
  return m ? unescapeXml(m[1]) : '';
}
function score(title,description) {
  const t=(title+' '+description).toLowerCase();
  let points=0;
  if (/request for proposal|\brfp\b|licitaci[oó]n|convocatoria/.test(t)) points+=35;
  if (/seeking vendors|buscamos proveedor|looking for|seeking|buscamos/.test(t)) points+=25;
  if (/automation|automatizaci[oó]n|chatbot|customer support|inteligencia artificial|workflow/.test(t)) points+=20;
  if (/partner|proveedor|vendor/.test(t)) points+=10;
  return Math.min(90,points);
}
function parseFeed(xml,market) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>{
    const item=m[1],title=tag(item,'title'),link=tag(item,'link'),description=tag(item,'description');
    const publishedAt=tag(item,'pubDate');
    const published=Date.parse(publishedAt);
    if (!title || !/^https:\/\//.test(link) || !Number.isFinite(published) || published>now.getTime()+86400000 || now.getTime()-published>MAX_AGE_DAYS*86400000) return null;
    const evidenceId=crypto.createHash('sha256').update(link).digest('hex').slice(0,20);
    return {evidence_id:evidenceId,market,title,source_url:link,published_at:new Date(published).toISOString(),score:score(title,description),status:'RESEARCH_REQUIRED',buyer_verified:false,contact_verified:false,buying_intent_verified:false,description:description.slice(0,400)};
  }).filter(Boolean);
}
async function retrieve(query) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const url='https://news.google.com/rss/search?q='+encodeURIComponent(query)+'&hl=en-US&gl=US&ceid=US:en';
    const res=await fetch(url,{signal:controller.signal,headers:{'user-agent':'Boltech-BLIA01-Research/1.0','accept':'application/rss+xml, application/xml'}});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const xml=await res.text();
    if(xml.length>2_000_000) throw new Error('Feed exceeds size limit');
    return xml;
  } finally {clearTimeout(timer);}
}
async function main() {
  const findings=[],errors=[];
  for(const q of QUERIES) {
    try {findings.push(...parseFeed(await retrieve(q.query),q.market));}
    catch(err) {errors.push({market:q.market,reason:String(err.message).slice(0,160)});}
  }
  const seen=new Set();
  const unique=findings.filter(f=>{if(seen.has(f.evidence_id)) return false;seen.add(f.evidence_id);return true;})
    .sort((a,b)=>b.score-a.score || b.published_at.localeCompare(a.published_at)).slice(0,MAX_ITEMS);
  const result={schema_version:'1',agent:'BLIA-01',generated_at:now.toISOString(),mode:'DISCOVERY_RESEARCH_ONLY',sources:'Google News RSS',queries:QUERIES.map(q=>q.market+': '+q.query),candidate_count:unique.length,errors,items:unique,notice:'News results are unverified research signals, NOT qualified leads. Human verification of organization, buyer, contact and intent required before CRM handoff.'};
  const output=path.resolve(process.env.BLIA_OUTPUT || 'artifacts/blia01/candidates.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({agent:result.agent,candidate_count:unique.length,error_count:errors.length,output,mode:result.mode}));
  if(errors.length===QUERIES.length) process.exitCode=1;
}
if(require.main===module) main().catch(err=>{console.error('BLIA01_FATAL:',err.message);process.exitCode=1;});
module.exports={parseFeed,score};
