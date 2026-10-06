export function basicTelegramReply(text, name = 'Ricardo') {
  if (/^(hola|hello|hi|buenos días|buenas tardes|buenas noches)[!.\s]*$/i.test(text)) {
    return `Hola, ${name}. Recibí tu mensaje. ¿En qué puedo ayudarte?`;
  }
  const match = text.match(/^(?:¿?\s*(?:cu[aá]nto\s+es|what\s+is)\s+)?(-?\d+(?:\.\d+)?)\s*([+*/x×−-])\s*(-?\d+(?:\.\d+)?)\s*[?¿=]*$/i);
  if (!match) return null;
  const a = Number(match[1]), b = Number(match[3]), op = match[2].toLowerCase();
  if (op === '/' && b === 0) return 'No se puede dividir entre cero.';
  const value = op === '+' ? a + b : ['-', '−'].includes(op) ? a - b : op === '/' ? a / b : a * b;
  return Number.isFinite(value) ? `${a} ${op} ${b} = ${Number(value.toPrecision(12))}` : null;
}

export async function requestOpenAiReply(text, env, fetcher = fetch) {
  const key = String(env.OPENAI_API_KEY || '').trim();
  if (!key) return { reply: null, reason: 'AI_NOT_CONFIGURED' };
  try {
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.TELEGRAM_OPENAI_MODEL || 'gpt-5-mini', max_completion_tokens: 1200,
        messages: [{ role: 'system', content: 'Eres el asistente de Ricardo, en El Salvador. Responde directamente en el idioma del usuario. No afirmes consultar correos, CRM, calendarios o ejecutar acciones: este chat no tiene esas herramientas conectadas. No inventes estados comerciales ni prometas disponibilidad permanente.' }, { role: 'user', content: text }] })
    });
    if (!response.ok) return { reply: null, reason: response.status === 401 ? 'AI_AUTH_FAILED' : response.status === 429 ? 'AI_CAPACITY_UNAVAILABLE' : 'AI_PROVIDER_ERROR' };
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    return { reply: reply || null, reason: reply ? null : 'AI_EMPTY_REPLY' };
  } catch { return { reply: null, reason: 'AI_CONNECTION_FAILED' }; }
}
