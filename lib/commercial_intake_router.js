// Pure commercial intake router. No side effects, no messaging, no price generation.
// Intended for all channel adapters; execution requires a durable RSI handoff.
export const CHANNELS = Object.freeze(['web','apollo','gmail','a2a','upwork','whatsapp','other']);
export function routeCommercialIntake(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('INVALID_INTAKE');
  const channel = String(input.channel || '').toLowerCase();
  if (!CHANNELS.includes(channel)) throw new Error('UNSUPPORTED_CHANNEL');
  const intent = String(input.intent || 'general').toLowerCase();
  const contactable = input.consent === true && input.contactValidated === true;
  let targetRole = 'RSI-01', reason = 'NEEDS_QUALIFICATION';
  if (intent === 'custom_quote' || intent === 'technical_assessment') {
    targetRole = 'RSI-02'; reason = 'TECHNICAL_ASSESSMENT_REQUIRED';
  } else if (intent === 'prebuilt_quote' && input.scopeComplete === true) {
    targetRole = 'RSI-03'; reason = 'PREBUILT_QUOTE_READY_FOR_REVIEW';
  } else if (intent === 'accepted_quote' && input.quoteApproved === true && input.quoteVerified === true) {
    targetRole = 'RSI-03'; reason = 'APPROVED_QUOTE_VERIFIED';
  } else if (intent === 'prebuilt_quote' || intent === 'accepted_quote') {
    targetRole = 'RSI-02'; reason = 'MISSING_SCOPE_OR_QUOTE_VERIFICATION';
  }
  return Object.freeze({
    channel, targetRole, reason,
    contactable, outreachAllowed: contactable && input.outreachAuthorized === true,
    quoteIssueAllowed: false, // Only separate Direction-approved quote workflow may issue one.
    paymentAllowed: false, // Only existing approved Wompi workflow.
    synthetic: input.synthetic === true
  });
}
