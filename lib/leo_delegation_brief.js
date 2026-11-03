// Delegation brief and progress projection for Leo.
// The guide to ChatGPT Dots informs the user-facing workflow; this does NOT
// provide or impersonate the proprietary ChatGPT Dots service.
const invalid = (code) => {
  throw Object.assign(new Error(code), { code, statusCode: 400 });
};
const clean = (text) => typeof text === 'string' ? text.trim() : '';
const safe = (text, min, max) =>
  text.length >= min && text.length <= max && !/[\u0000-\u001F\u007F]/.test(text);

export function normalizeLeoDelegation(value) {
  if (value === undefined) return null; // Legacy objective records retain their contract.
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('LEO_DELEGATION_INVALID');

  // Unsupported fields must not be mistaken for permissions or activated scheduling.
  const allowed = new Set(['expectedResult', 'sources', 'reviewInstructions', 'preferredChannel']);
  if (Object.keys(value).some((name) => !allowed.has(name))) invalid('LEO_DELEGATION_FIELD_UNSUPPORTED');

  const expectedResult = clean(value.expectedResult);
  if (!safe(expectedResult, 10, 500)) invalid('LEO_DELEGATION_RESULT_INVALID');
  if (value.sources !== undefined && !Array.isArray(value.sources)) invalid('LEO_DELEGATION_SOURCES_INVALID');
  const sources = value.sources || [];
  if (sources.length > 6 || sources.some((source) => !safe(clean(source), 3, 180))) {
    invalid('LEO_DELEGATION_SOURCES_INVALID');
  }
  const reviewInstructions = clean(value.reviewInstructions ?? '');
  if (reviewInstructions && !safe(reviewInstructions, 5, 300)) invalid('LEO_DELEGATION_REVIEW_INVALID');
  const preferredChannel = value.preferredChannel ?? 'chat';
  if (!['chat', 'voice'].includes(preferredChannel)) invalid('LEO_DELEGATION_CHANNEL_INVALID');

  return {
    expectedResult,
    sources: [...new Set(sources.map(clean))],
    reviewInstructions,
    preferredChannel, // Preference, not proof that an audio channel is connected.
    sourceStatus: 'REFERENCES_ONLY',
    scheduleStatus: 'NOT_CONFIGURED',
    notificationStatus: 'NOT_CONFIGURED',
    executionPolicy: 'READ_ONLY_WITH_EXPLICIT_APPROVAL'
  };
}

export function summarizeLeoDelegation(record) {
  if (!record) return null;
  return {
    id: record.id,
    tenantId: record.tenantId,
    status: record.status,
    version: record.version,
    updatedAt: record.updatedAt,
    criteria: record.criteria,
    plannedSteps: Array.isArray(record.plan) ? record.plan.length : 0,
    lastReceipt: record.lastTool?.receipt ?? null,
    delegation: record.delegation ?? null,
    recentActivity: (record.events || []).slice(-12).map((event) => ({
      id: event.id ?? null,
      kind: event.kind,
      at: event.at
    }))
  };
}
