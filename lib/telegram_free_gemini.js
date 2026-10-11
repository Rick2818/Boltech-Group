// Opt-in Gemini replies for the Telegram assistant, intended for a Google AI Studio
// key from a project WITHOUT billing (free tier). Off unless both variables are set;
// the legacy GEMINI_API_KEY / OPENAI_API_KEY are never read here, so old keys cannot
// switch it on. Text only: no voice, no tools, no actions.
const MODEL = 'gemini-2.5-flash';
const SYSTEM = 'Eres el asistente de Ricardo, en El Salvador. Responde directo y breve, en el idioma del usuario. No afirmes consultar correos, CRM, calendarios, pagos ni ejecutar acciones: este chat no tiene esas herramientas conectadas. No inventes estados comerciales, ventas ni disponibilidad. Si no sabes algo, dilo.';
const usage = { day: '', count: 0 };

export function isFreeGeminiEnabled(env = process.env) {
  return String(env.TELEGRAM_FREE_GEMINI_ENABLED || '').trim().toLowerCase() === 'true'
    && Boolean(String(env.TELEGRAM_FREE_GEMINI_API_KEY || '').trim());
}

export function dailyLimit(env = process.env) {
  const n = Number.parseInt(env.TELEGRAM_FREE_GEMINI_DAILY_LIMIT, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 30;
}

export async function requestFreeGeminiReply(text, env = process.env, fetcher = fetch, now = () => new Date()) {
  if (!isFreeGeminiEnabled(env)) return { reply: null, reason: 'AI_NOT_ENABLED' };
  const day = now().toISOString().slice(0, 10);
  if (usage.day !== day) { usage.day = day; usage.count = 0; }
  // Best-effort cap per server instance, to stay inside free-tier quotas.
  if (usage.count >= dailyLimit(env)) return { reply: null, reason: 'AI_DAILY_LIMIT' };
  usage.count += 1;
  try {
    const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env.TELEGRAM_FREE_GEMINI_API_KEY).trim() },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 2000) }] }],
        generationConfig: { maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!response.ok) {
      return { reply: null, reason: response.status === 429 ? 'AI_CAPACITY_UNAVAILABLE'
        : [400, 401, 403].includes(response.status) ? 'AI_AUTH_FAILED' : 'AI_PROVIDER_ERROR' };
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const reply = Array.isArray(parts)
      ? parts.filter(p => typeof p?.text === 'string').map(p => p.text).join('').trim() : '';
    return { reply: reply || null, reason: reply ? null : 'AI_EMPTY_REPLY' };
  } catch { return { reply: null, reason: 'AI_CONNECTION_FAILED' }; }
}

export function resetFreeGeminiUsageForTests() { usage.day = ''; usage.count = 0; }
