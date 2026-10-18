const N8N_JOBS_URL = 'https://community.n8n.io/c/jobs/13.json?page=0';
const N8N_FORUM_ORIGIN = 'https://community.n8n.io';

const hiringPattern = /\b(hiring|hire|looking for|seeking|need(?:s)?|job opening|freelance required|freelancer required|contractor required|wanted|opportunity)\b/i;
const forHirePattern = /\b(for hire|available for hire|available for freelance|looking for work|freelancer available)\b/i;
const freelancePattern = /\b(freelance|freelancer|contract(?:or)?|part[- ]time|project[- ]based|fixed[- ]price|per project)\b/i;

function text(value) {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export function classifyN8nJobTopic(topic, { qaCaseId = null } = {}) {
  if (!topic || typeof topic !== 'object') return null;
  const id = String(topic.id ?? '').trim();
  if (!id || (qaCaseId && id === String(qaCaseId))) return null;
  if (topic.synthetic === true || topic.pinned === true) return null;

  const title = text(topic.title);
  const excerpt = text(topic.excerpt);
  const searchable = `${title} ${excerpt}`;
  if (!title || forHirePattern.test(searchable) || !hiringPattern.test(searchable)) return null;

  const slug = text(topic.slug);
  const url = slug ? `${N8N_FORUM_ORIGIN}/t/${encodeURIComponent(slug)}/${encodeURIComponent(id)}` : '';
  if (!url) return null;

  const postedAt = typeof topic.created_at === 'string' ? topic.created_at : null;
  const ageDays = postedAt && Number.isFinite(Date.parse(postedAt))
    ? Math.max(0, Math.floor((Date.now() - Date.parse(postedAt)) / 86400000))
    : null;
  return {
    sourcePlatform: 'n8n_community_jobs',
    sourceRecordId: id,
    sourceUrl: url,
    opportunityType: 'FREELANCE_WORK_CANDIDATE',
    title,
    excerpt: excerpt.slice(0, 700),
    postedAt,
    ageDays,
    freshness: ageDays == null ? 'UNKNOWN' : ageDays <= 14 ? 'RECENT' : ageDays <= 30 ? 'CHECK_AGE' : 'STALE_VERIFY_BEFORE_REVIEW',
    lastActivityAt: topic.last_posted_at || null,
    replyCount: Number.isFinite(topic.reply_count) ? topic.reply_count : null,
    workTypeSignal: freelancePattern.test(searchable) ? 'FREELANCE_OR_CONTRACT_SIGNAL' : 'VERIFY_WORK_TYPE',
    status: 'REQUIRES_MANUAL_OPEN_STATUS_AND_FIT_REVIEW',
    contactAttempted: false,
    proposalSubmitted: false,
    connectsUsed: 0,
    qa: false
  };
}

export async function fetchN8nFreelanceOpportunities({ fetchImpl = fetch, qaCaseId = null } = {}) {
  const response = await fetchImpl(N8N_JOBS_URL, {
    method: 'GET',
    redirect: 'error',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw Object.assign(new Error('N8N_COMMUNITY_HTTP_ERROR'), { code: `N8N_COMMUNITY_HTTP_${response.status}` });
  }

  const body = await response.json();
  const topics = body?.topic_list?.topics;
  if (!Array.isArray(topics)) {
    throw Object.assign(new Error('N8N_COMMUNITY_INVALID_RESPONSE'), { code: 'N8N_COMMUNITY_SCHEMA_INVALID' });
  }

  const categoryId = Number(body?.category?.id ?? topics.find(x => x.category_id != null)?.category_id);
  if (!Number.isFinite(categoryId) || categoryId !== 13) {
    throw Object.assign(new Error('N8N_COMMUNITY_UNEXPECTED_CATEGORY'), { code: 'N8N_COMMUNITY_CATEGORY_MISMATCH' });
  }

  const opportunities = topics.map(topic => classifyN8nJobTopic(topic, { qaCaseId })).filter(Boolean);
  return { opportunities, fetchedTopics: topics.length, categoryId };
}
