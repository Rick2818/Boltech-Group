import crypto from 'node:crypto';
import net from 'node:net';

// Outbound A2A v1.0 JSON-RPC client. No network request can be driven by a
// caller-supplied URL: destinations must be pinned in server-only configuration.
export class A2AOutboundError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'A2AOutboundError';
    this.code = code;
    this.status = status;
  }
}

function pinnedHttps(value) {
  if (typeof value !== 'string') throw new A2AOutboundError('INVALID_TARGET', 'A2A target URL must be configured');
  let parsed;
  try { parsed = new URL(value); } catch { throw new A2AOutboundError('INVALID_TARGET', 'Invalid A2A target URL'); }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password ||
      parsed.search || parsed.hash || !host.includes('.') || net.isIP(host) ||
      /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
      host.endsWith('.localhost') || host === 'metadata.google.internal') {
    throw new A2AOutboundError('UNSAFE_TARGET', 'Only pinned public HTTPS hostnames are allowed');
  }
  return parsed.href;
}

export function loadOutboundTarget(targetId, env = process.env) {
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(targetId || '')) {
    throw new A2AOutboundError('INVALID_TARGET', 'Invalid target identifier');
  }
  if (env.A2A_OUTBOUND_ENABLED !== '1') {
    throw new A2AOutboundError('OUTBOUND_DISABLED', 'A2A outbound is not activated', 503);
  }
  let targets;
  try { targets = JSON.parse(env.A2A_OUTBOUND_TARGETS_JSON || '{}'); }
  catch { throw new A2AOutboundError('OUTBOUND_UNCONFIGURED', 'Approved targets configuration is invalid', 503); }
  if (!targets || typeof targets !== 'object' || Array.isArray(targets)) {
    throw new A2AOutboundError('OUTBOUND_UNCONFIGURED', 'Approved targets configuration is invalid', 503);
  }
  const target = Object.hasOwn(targets, targetId) ? targets[targetId] : null;
  if (!target || target.approved !== true || target.partnershipIntakeVerified !== true) {
    throw new A2AOutboundError('TARGET_NOT_APPROVED', 'Target is not approved for partnership A2A', 403);
  }
  if (typeof target.organization !== 'string' || target.organization.trim().length < 2) {
    throw new A2AOutboundError('INVALID_TARGET', 'Destination organization must be pinned');
  }
  const cardUrl = pinnedHttps(target.cardUrl);
  const endpoint = pinnedHttps(target.endpoint);
  if (!target.cardUrl.endsWith('/.well-known/agent-card.json') &&
      !target.cardUrl.endsWith('/.well-known/agent.json')) {
    throw new A2AOutboundError('INVALID_TARGET', 'Destination Agent Card must be well known');
  }
  const protocolVersion = target.protocolVersion || '1.0';
  if (!['1.0', '0.3.0'].includes(protocolVersion)) {
    throw new A2AOutboundError('UNSUPPORTED_PROTOCOL', 'Peer A2A protocol is not supported');
  }
  const authType = target.authType || 'bearer';
  if (!['bearer', 'api-key'].includes(authType) ||
      (authType === 'api-key' && protocolVersion !== '0.3.0')) {
    throw new A2AOutboundError('INVALID_TARGET', 'Unsupported peer authentication configuration');
  }
  const credentialEnv = target.credentialEnv || '';
  if (credentialEnv && !/^A2A_PEER_[A-Z0-9_]+_TOKEN$/.test(credentialEnv)) {
    throw new A2AOutboundError('INVALID_TARGET', 'Peer credential environment variable is invalid');
  }
  const credential = credentialEnv ? String(env[credentialEnv] || '') : '';
  if (credentialEnv && !credential) throw new A2AOutboundError('PEER_CREDENTIAL_MISSING', 'Peer A2A credential is missing', 503);
  return { targetId, cardUrl, endpoint, organization: target.organization.trim(), credential, protocolVersion, authType };
}

async function safeJson(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 65536) throw new A2AOutboundError('UNSAFE_RESPONSE', 'A2A provider response is too large', 502);
  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > 65536) throw new A2AOutboundError('UNSAFE_RESPONSE', 'A2A provider response is too large', 502);
  try { return JSON.parse(content); } catch { throw new A2AOutboundError('INVALID_RESPONSE', 'A2A provider did not return JSON', 502); }
}

export async function verifyOutboundAgentCard(target, fetchImpl = fetch) {
  let response;
  try {
    response = await fetchImpl(target.cardUrl, { method: 'GET', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  } catch { throw new A2AOutboundError('CARD_UNAVAILABLE', 'Verified agent card is unreachable', 502); }
  if (!response.ok) throw new A2AOutboundError('CARD_UNAVAILABLE', 'Agent card is unavailable', 502);
  const card = await safeJson(response);
  const org = card?.provider?.organization;
  const matching = target.protocolVersion === '0.3.0'
    ? card?.protocolVersion === '0.3.0' && card?.url === target.endpoint &&
      card?.preferredTransport === 'JSONRPC'
    : Array.isArray(card?.supportedInterfaces) && card.supportedInterfaces.some(
        x => x?.url === target.endpoint && x.protocolBinding === 'JSONRPC' && x.protocolVersion === '1.0'
      );
  if (org !== target.organization || !matching) {
    throw new A2AOutboundError('CARD_MISMATCH', 'Agent card provider or A2A endpoint did not match the approved destination', 409);
  }
  const needsAuth = Boolean(card.securityRequirements?.length || (Array.isArray(card.security) && card.security.length) || (card.securitySchemes && Object.keys(card.securitySchemes).length));
  if (needsAuth && !target.credential) {
    throw new A2AOutboundError('PEER_AUTH_REQUIRED', 'Peer requires credentials; none configured', 503);
  }
  return { name: typeof card.name === 'string' ? card.name.slice(0, 160) : target.organization,
    organization: org, endpoint: target.endpoint, protocolVersion: target.protocolVersion };
}

function assertId(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(id)) {
    throw new A2AOutboundError('INVALID_INTENT', 'A stable intentId (8-120 safe characters) is required');
  }
}

function assertText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new A2AOutboundError('INVALID_MESSAGE', label + ' must be nonempty and at most ' + max + ' characters');
  }
}

export function buildOutboundMessage({ targetId, intentId, subject, message, protocolVersion = '1.0' }) {
  assertId(intentId);
  assertText(subject, 160, 'Subject');
  assertText(message, 5000, 'Message');
  if (typeof targetId !== 'string') throw new A2AOutboundError('INVALID_TARGET', 'Target is required');
  const messageId = 'boltech-' + crypto.createHash('sha256')
    .update(JSON.stringify([targetId, intentId])).digest('hex').slice(0, 64);
  const legacy = protocolVersion === '0.3.0';
  const text = subject.trim() + '\n\n' + message.trim();
  return {
    jsonrpc: '2.0', id: intentId, method: legacy ? 'message/send' : 'SendMessage',
    params: {
      message: {
        messageId, role: legacy ? 'user' : 'ROLE_USER',
        parts: [legacy ? { kind: 'text', text } : { text, mediaType: 'text/plain' }]
      },
      ...(legacy ? {} : { configuration: { acceptedOutputModes: ['text/plain', 'application/json'] } })
    }
  };
}

function responseEnvelope(payload, id) {
  if (!payload || payload.jsonrpc !== '2.0' || payload.id !== id) {
    throw new A2AOutboundError('INVALID_RESPONSE', 'A2A provider JSON-RPC response did not match the request', 502);
  }
  if (payload.error) return { rejected: true, errorCode: typeof payload.error.code === 'number' ? payload.error.code : -32000 };
  const task = payload.result?.task || (payload.result?.id && payload.result?.status ? payload.result : null);
  const reply = payload.result?.message || (payload.result?.role && payload.result?.parts ? payload.result : null);
  if (!task && !reply) throw new A2AOutboundError('INVALID_RESPONSE', 'A2A provider gave no task or message receipt', 502);
  const textParts = [
    ...(Array.isArray(task?.artifacts) ? task.artifacts.flatMap(a => a?.parts || []) : []),
    ...(Array.isArray(reply?.parts) ? reply.parts : [])
  ].filter(p => typeof p?.text === 'string').map(p => p.text);
  return {
    acknowledged: true, replyText: textParts.join('\n').slice(0, 2000),
    remoteTaskId: typeof task?.id === 'string' ? task.id.slice(0, 160) : null,
    remoteState: typeof task?.status?.state === 'string' ? task.status.state.slice(0, 90) : null,
    responseKind: task ? 'task' : 'message'
  };
}

async function rpcPost(target, payload, fetchImpl) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'A2A-Version': target.protocolVersion };
  if (target.credential) {
    if (target.authType === 'api-key') headers['x-api-key'] = target.credential;
    else headers.Authorization = 'Bearer ' + target.credential;
  }
  let response;
  try {
    response = await fetchImpl(target.endpoint, { method: 'POST', redirect: 'error',
      headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  } catch { throw new A2AOutboundError('TRANSPORT_UNCERTAIN', 'Transport did not confirm whether the peer received the request', 502); }
  const answer = await safeJson(response);
  if (!response.ok) throw new A2AOutboundError('PROVIDER_HTTP_ERROR', 'Peer returned HTTP ' + response.status, 502);
  return responseEnvelope(answer, payload.id);
}

export async function sendOutboundA2A(target, input, fetchImpl = fetch) {
  const payload = buildOutboundMessage({ ...input, targetId: target.targetId, protocolVersion: target.protocolVersion });
  return await rpcPost(target, payload, fetchImpl);
}

export async function getOutboundTask(target, remoteTaskId, fetchImpl = fetch) {
  if (typeof remoteTaskId !== 'string' || !remoteTaskId || remoteTaskId.length > 160) {
    throw new A2AOutboundError('INVALID_TASK', 'Invalid remote task identifier');
  }
  const id = 'get-' + crypto.createHash('sha256').update(remoteTaskId).digest('hex').slice(0, 24);
  const payload = { jsonrpc: '2.0', id, method: target.protocolVersion === '0.3.0' ? 'tasks/get' : 'GetTask', params: { id: remoteTaskId } };
  const result = await rpcPost(target, payload, fetchImpl);
  if (!result.acknowledged || result.responseKind !== 'task' || result.remoteTaskId !== remoteTaskId) {
    throw new A2AOutboundError('INVALID_RESPONSE', 'Peer task receipt does not match requested task', 502);
  }
  return result;
}
