import crypto from 'node:crypto';
import { taskIdentity, claimTask, completeTask, readTask } from '../lib/a2a_task_store.js';
import {
  A2AOutboundError, loadOutboundTarget, verifyOutboundAgentCard,
  sendOutboundA2A, getOutboundTask, buildOutboundMessage
} from '../lib/a2a_outbound_client.js';

// This endpoint is not a public prospecting API. It requires a distinct
// operator secret, an explicit outbound enable switch, and pinned peer cards.
function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}
function authorized(req) {
  const secret = process.env.A2A_OUTBOUND_OPERATOR_TOKEN || '';
  if (secret.length < 32) throw new A2AOutboundError('OPERATOR_UNCONFIGURED', 'A2A operator authorization is not configured', 503);
  const supplied = String(req.headers?.authorization || '');
  if (!supplied.startsWith('Bearer ')) return false;
  const a = Buffer.from(supplied.slice(7)); const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function jobKey(targetId) { return 'outbound:' + targetId; }
function recordId(targetId, intentId) { return taskIdentity(jobKey(targetId), intentId); }
function contentHash(target, body) {
  const payload = buildOutboundMessage({ ...body, targetId: target.targetId, protocolVersion: target.protocolVersion });
  return crypto.createHash('sha256').update(JSON.stringify([
    target.endpoint, payload.params.message.messageId, payload.params.message.parts
  ])).digest('hex');
}
async function getStored(targetId, intentId) {
  const key = recordId(targetId, intentId);
  return await readTask(jobKey(targetId), key);
}

async function processRequest(req, res) {
  if (!['POST'].includes(req.method)) {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'POST required' });
  }
  if (!authorized(req)) return respond(res, 401, { error: 'Operator bearer credential required' });
  if (Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') > 12000) {
    return respond(res, 413, { error: 'Request too large' });
  }
  const { operation, targetId, intentId } = req.body || {};
  if (!['send', 'receipt', 'get-task'].includes(operation)) {
    throw new A2AOutboundError('INVALID_OPERATION', 'Unsupported A2A outbound operation');
  }
  const target = loadOutboundTarget(targetId);
  // All operations require the same target approval, including receipt reads.
  if (typeof intentId !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(intentId)) {
    throw new A2AOutboundError('INVALID_INTENT', 'Valid intentId is required');
  }

  if (operation === 'receipt') {
    const record = await getStored(targetId, intentId);
    if (!record) return respond(res, 404, { status: 'NOT_FOUND' });
    return respond(res, 200, { status: record.state, receipt: record.state === 'completed' ? record.task : null });
  }
  if (operation === 'send') {
    const { subject, message } = req.body;
    const fingerprint = contentHash(target, { intentId, subject, message });
    const identity = recordId(targetId, intentId);
    const existing = await getStored(targetId, intentId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) return respond(res, 409, {
        status: 'INTENT_CONFLICT', message: 'The approved intentId already belongs to different content'
      });
      if (existing.state !== 'completed') return respond(res, 409, {
        status: 'DELIVERY_UNCERTAIN', message: 'Request may have reached peer; operator reconciliation required before another attempt'
      });
      const rejected = existing.task?.state === 'REMOTE_REJECTED';
      return respond(res, rejected ? 422 : 200, {
        status: rejected ? 'REMOTE_REJECTED' : 'REMOTE_ACKNOWLEDGED',
        receipt: existing.task, replay: true
      });
    }
    // Check actual peer identity and declared A2A capability before acquiring
    // an idempotence lock. This is not evidence of commercial intake approval.
    const card = await verifyOutboundAgentCard(target);
    const claim = await claimTask(jobKey(targetId), identity, fingerprint);
    if (!claim.claimed) {
      if (claim.existing?.fingerprint !== fingerprint) return respond(res, 409, { status: 'INTENT_CONFLICT' });
      if (claim.existing?.state === 'completed') return respond(res, 200, {
        status: 'REMOTE_ACKNOWLEDGED', receipt: claim.existing.task, replay: true
      });
      return respond(res, 409, { status: 'DELIVERY_UNCERTAIN' });
    }
    const sentAt = new Date().toISOString();
    const result = await sendOutboundA2A(target, { intentId, subject, message });
    if (result.rejected) {
      // Rejected RPC response is a genuine provider reply, not acceptance.
      const receipt = {
        targetId, organization: card.organization, intentId, providerErrorCode: result.errorCode,
        state: 'REMOTE_REJECTED', checkedAt: sentAt
      };
      await completeTask(jobKey(targetId), identity, fingerprint, receipt);
      return respond(res, 422, { status: 'REMOTE_REJECTED', receipt });
    }
    const receipt = {
      targetId, organization: card.organization, intentId,
      remoteTaskId: result.remoteTaskId, remoteState: result.remoteState,
      replyText: result.replyText || '', responseKind: result.responseKind, state: 'REMOTE_ACKNOWLEDGED', checkedAt: sentAt
    };
    await completeTask(jobKey(targetId), identity, fingerprint, receipt);
    return respond(res, 200, { status: 'REMOTE_ACKNOWLEDGED', receipt });
  }

  const stored = await getStored(targetId, intentId);
  if (!stored || stored.state !== 'completed' || stored.task?.state !== 'REMOTE_ACKNOWLEDGED' ||
      !stored.task?.remoteTaskId) {
    throw new A2AOutboundError('TASK_UNAVAILABLE', 'No confirmed remote A2A task receipt for this intent', 404);
  }
  const card = await verifyOutboundAgentCard(target);
  const result = await getOutboundTask(target, stored.task.remoteTaskId);
  if (result.rejected) return respond(res, 422, {
    status: 'REMOTE_REJECTED', providerErrorCode: result.errorCode, targetId
  });
  return respond(res, 200, {
    status: 'REMOTE_TASK_READ', organization: card.organization, targetId,
    remoteTaskId: result.remoteTaskId, remoteState: result.remoteState,
    replyText: result.replyText || '', checkedAt: new Date().toISOString()
  });
}
export default async function handler(req, res) {
  try {
    return await processRequest(req, res);
  } catch (error) {
    if (error instanceof A2AOutboundError) {
      return respond(res, error.status, { status: error.code, message: error.message });
    }
    return respond(res, 503, { status: 'OUTBOUND_UNAVAILABLE', message:
      'A2A outbound state or transport is uncertain. Do not resend with a new intentId.' });
  }
}
