import crypto from 'node:crypto';
import { redisCommand } from './rsi_handoff_store.js';
import { createSdrGmail, gmailReadiness, sdrJobId, SDR_SENDER } from './sdr_gmail.js';

const BASE = 'https://api.airtable.com/v0/appCQZd0IhBHFoZ9P/tblZaox2MX5uYA5PZ/';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export function sdrWindow(now = new Date()) {
  const local = new Date(now.getTime() - 6 * 3600000);
  return { day: local.toISOString().slice(0, 10), allowed: local.getUTCDay() >= 1 && local.getUTCDay() <= 5 && local.getUTCHours() >= 9 && local.getUTCHours() < 17 };
}
export function validateSdrCandidate(p, now = new Date()) {
  const r = p?.commercialResearch, age = now.getTime() - Date.parse(r?.history?.checkedAt);
  if (p?.status !== 'READY_FOR_CONTACT' || p.contactEligible !== true || p.contactHold || !/^rec[a-zA-Z0-9]+$/.test(p.recordId || '') || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(p.email || '')) fail('SDR_CANDIDATE_NOT_APPROVED');
  if (!r?.channelVerified || !r.observation || !r.hypothesis || !r.sources?.length || !r.salesReview?.accepted || !r.salesReview.reviewedBy || !Number.isFinite(Date.parse(r.salesReview.reviewedAt)) || !r.individualMessage || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(r.accountKey || '')) fail('SDR_RESEARCH_INCOMPLETE');
  if (!r.sources.every(u => { try { return new URL(u).protocol === 'https:'; } catch { return false; } })) fail('SDR_SOURCE_INVALID');
  if (!(age >= 0 && age <= 3600000) || ['gmail','apollo','crm','suppression'].some(k => r.history[k] !== 'CLEAR')) fail('SDR_HISTORY_NOT_CURRENT');
  if (!p.subject || /[\r\n\x00]/.test(p.subject) || p.subject.length > 250 || r.individualMessage.length > 10000) fail('SDR_INVALID_MESSAGE');
  return { id: sdrJobId(r.accountKey), account: r.accountKey, recordId: p.recordId, email: p.email.toLowerCase(), subject: p.subject, text: r.individualMessage, rfcMessageId: `boltech-sdr-${sdrJobId(r.accountKey)}@boltech-group.vercel.app`, research: r };
}
export function createSdrDispatch({ command = redisCommand, gmail = createSdrGmail(), now = () => new Date(), fetcher = fetch, env = process.env } = {}) {
  const key = id => 'boltech:sdr:initial:' + id;
  async function read(id) {
    if (!/^[a-f0-9]{64}$/.test(id || '')) fail('SDR_INVALID_ID');
    const raw = await command(['GET', key(id)]); return raw ? JSON.parse(raw) : null;
  }
  async function persist(job) { await command(['SET', key(job.id), JSON.stringify(job)]); return job; }
  async function crm(recordId, method = 'GET', fields) {
    if (!env.AIRTABLE_TOKEN) fail('SDR_CRM_NOT_CONFIGURED');
    let res;
    try { res = await fetcher(BASE + recordId, { method, headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' }, ...(fields ? { body: JSON.stringify({ fields }) } : {}), signal: AbortSignal.timeout(8000) }); }
    catch { fail('SDR_CRM_UNAVAILABLE'); }
    if (!res.ok) fail('SDR_CRM_UNAVAILABLE');
    return await res.json();
  }
  async function markCrm(job) {
    const row = await crm(job.recordId);
    const notes = row.fields?.Notes || '';
    const marker = `[SDR_SEND:${job.id}]`;
    await crm(job.recordId, 'PATCH', { 'Commercial Stage': 'Contacted', Notes: notes.includes(marker) ? notes : notes + `\n${marker}\n${JSON.stringify({ status:'SENT', messageId:job.messageId, threadId:job.threadId, sentAt:job.sentAt, sender:SDR_SENDER })}` });
    return persist({ ...job, crmState: 'SYNCED', crmSyncedAt: now().toISOString() });
  }
  async function runCandidate(p) {
    if (!sdrWindow(now()).allowed) fail('SDR_OUTSIDE_SEND_WINDOW');
    const candidate = validateSdrCandidate(p, now());
    const existing = await read(candidate.id);
    if (existing) return { attempted:false, job:existing }; // An unknown POST is never repeated.
    await gmail.verify();
    const row = await crm(candidate.recordId);
    const f = row.fields || {};
    if (String(f['Contact Email']).toLowerCase() !== candidate.email || /SENT|SEND_PENDING|UNKNOWN|SUPPRESSED|Do not contact|Unsubscribed|bounced/i.test([f.Notes, f['Commercial Stage'], f.Status].join(' '))) fail('SDR_CRM_CONTACT_HOLD');
    const histories = await gmail.search(`in:anywhere {to:${candidate.email} from:${candidate.email} to:(@${candidate.account})}`);
    if (histories.length) fail('SDR_EXISTING_ACCOUNT_HISTORY');
    const recent = await gmail.search('in:sent newer_than:1d');
    // Shared mailbox usage, including Apollo and human sends, consumes capacity.
    if (recent.length >= 100) fail('SDR_MAILBOX_CAPACITY_HOLD');
    const hourStart = Math.floor(now().getTime() / 3600000) * 3600000;
    const hourAttempts = await command(['ZCOUNT','boltech:sdr:jobs',hourStart,hourStart+3599999]);
    if (!Number.isFinite(Number(hourAttempts)) || Number(hourAttempts) >= 20) fail('SDR_HOURLY_CAPACITY_HOLD');
    const job = { ...candidate, state:'SEND_PENDING', campaignDay:sdrWindow(now()).day, claimedAt:now().toISOString(), sender:SDR_SENDER, authorization:'Ricardo 5-7oct2026; researched initial only', crmState:'PENDING' };
    if (await command(['SET', key(job.id), JSON.stringify(job), 'NX']) !== 'OK') return { attempted:false, job:await read(job.id) };
    await command(['ZADD', 'boltech:sdr:jobs', now().getTime(), job.id]);
    // Confirm durable readback before any provider mutation.
    if ((await read(job.id))?.state !== 'SEND_PENDING') fail('SDR_CLAIM_UNCONFIRMED');
    try { await crm(job.recordId, 'PATCH', { Notes: (f.Notes || '') + `\n[SDR_PENDING:${job.id}] ${JSON.stringify({email:job.email,subject:job.subject,text:job.text,source:job.research.sources,claimedAt:job.claimedAt})}` }); }
    catch { return {attempted:false,job:await persist({...job,state:'BLOCKED',code:'SDR_CRM_PENDING_UNCONFIRMED'})}; }
    let receipt;
    try { receipt = await gmail.send(job); }
    catch(error) { const code=error.code||'GMAIL_SEND_UNKNOWN'; return {attempted:true,job:await persist({...job,state:code==='GMAIL_SEND_UNKNOWN'?'UNKNOWN':'FAILED',code})}; }
    const sent = await persist({ ...job, ...receipt, state:'SENT', sentAt:now().toISOString(), crmState:'SYNC_PENDING' });
    try { return {attempted:true,job:await markCrm(sent)}; }
    catch { return {attempted:true,job:sent}; }
  }
  async function reconcile(id) {
    const job = await read(id); if (!job) fail('SDR_JOB_NOT_FOUND');
    if (job.state === 'SENT') return job.crmState === 'SYNCED' ? job : markCrm(job);
    if (!['SEND_PENDING','UNKNOWN'].includes(job.state)) return job;
    await gmail.verify();
    const found = await gmail.search(`in:sent rfc822msgid:${job.rfcMessageId}`);
    if (found.length !== 1) return { ...job, reconciliation:'NO_UNIQUE_PROVIDER_RECEIPT', retryAllowed:false };
    const sent = await persist({...job,state:'SENT',messageId:found[0].id,threadId:found[0].threadId,sentAt:null,reconciledAt:now().toISOString(),crmState:'SYNC_PENDING'});
    return markCrm(sent); // Never substitute reconciliation time for actual send time.
  }
  async function run(p) {
    const lease = crypto.randomUUID();
    if (await command(['SET','boltech:sdr:mailbox-lease',lease,'NX','PX',90000]) !== 'OK') fail('SDR_MAILBOX_BUSY');
    try { return await runCandidate(p); }
    finally { await command(['EVAL',"if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,'boltech:sdr:mailbox-lease',lease]); }
  }
  async function metrics() {
    const ids = await command(['ZRANGE','boltech:sdr:jobs',0,999]);
    if (!Array.isArray(ids)) fail('SDR_STORAGE_INVALID');
    const jobs = await Promise.all(ids.filter(id=>/^[a-f0-9]{64}$/.test(id)).map(read));
    const states = jobs.filter(Boolean).reduce((a,j)=>(a[j.state]=(a[j.state]||0)+1,a),{});
    return { registeredJobs:jobs.filter(Boolean).length, states, scope:'First 1000 durable SDR jobs only; excludes earlier connector sends', investigated:null, approved:null, attempted:jobs.filter(j=>j && ['SENT','FAILED','UNKNOWN'].includes(j.state)).length, sent:states.SENT||0, failed:states.FAILED||0, unknown:states.UNKNOWN||0, responses:null, technicalCompletedNotCounted:true };
  }
  return {run,reconcile,read,metrics,status:()=>({...gmailReadiness(env),storageConfigured:!!env.UPSTASH_REDIS_REST_URL&&!!env.UPSTASH_REDIS_REST_TOKEN,crmConfigured:!!env.AIRTABLE_TOKEN,automatedCampaignEnabled:false}),verify:gmail.verify};
}
