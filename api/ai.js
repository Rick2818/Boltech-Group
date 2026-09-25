/**
 * =============================================================================
 * ENDPOINT SERVERLESS: VERCEL AI SDK (VERCEL & EXPRESS RUNTIME)
 * =============================================================================
 * Rutas:
 *   GET  /api/ai -> Diagnóstico de proveedores de IA y modelos disponibles
 *   POST /api/ai -> Inferencia de IA (estándar o streaming)
 * SOC-2 | In-Memory RAM | Resilient Zero-Trust
 * =============================================================================
 */

import {
  applyStrictBankingHeaders,
  resolveCorsOrigin,
  checkRateLimit
} from '../lib/fiduciary_core.js';
import {
  getAIProvidersStatus,
  generateAIResponse,
  streamAIResponse
} from '../lib/ai_sdk.js';

export default async function handler(req, res) {
  applyStrictBankingHeaders(res);

  const requestOrigin = req.headers.origin;
  const allowedOrigin = resolveCorsOrigin(requestOrigin, process.env.NODE_ENV !== 'production');
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate Limiter perimetral
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const { allowed, remainingSeconds } = checkRateLimit(clientIp, 40, 60000);
  if (!allowed) {
    res.setHeader('Retry-After', remainingSeconds);
    return res.status(429).json({ error: 'Too Many Requests', retryAfterSeconds: remainingSeconds });
  }

  try {
    // 1. GET: Consulta de estado y capacidades del SDK
    if (req.method === 'GET') {
      const status = getAIProvidersStatus();
      return res.status(200).json(status);
    }

    // 2. POST: Inferencia con Vercel AI SDK
    if (req.method === 'POST') {
      const body = req.body || {};
      const {
        prompt,
        system,
        provider = 'qwen',
        modelName,
        apiKey,
        baseURL,
        stream = false,
        temperature = 0.7,
        maxTokens = 2048
      } = body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'El campo "prompt" es requerido y debe ser una cadena de texto válida.'
        });
      }

      // Modo Streaming
      if (stream) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache, no-transform');

        const result = await streamAIResponse({
          prompt,
          system,
          provider,
          modelName,
          apiKey,
          baseURL,
          temperature,
          maxTokens
        });

        for await (const chunk of result.textStream) {
          res.write(chunk);
        }
        return res.end();
      }

      // Modo Síncrono Estándar
      const response = await generateAIResponse({
        prompt,
        system,
        provider,
        modelName,
        apiKey,
        baseURL,
        temperature,
        maxTokens
      });

      const defaultModelForProvider = provider === 'qwen' || provider === 'dashscope' || provider === 'openrouter'
        ? 'qwen-3.8'
        : (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash');

      return res.status(200).json({
        success: true,
        text: response.text,
        finishReason: response.finishReason,
        usage: response.usage,
        provider,
        model: modelName || defaultModelForProvider
      });
    }

    return res.status(405).json({ error: 'Método HTTP no permitido' });
  } catch (error) {
    console.error('[AI SDK Error]:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Error en la ejecución del modelo de IA',
      code: error?.name || 'AI_SDK_EXECUTION_ERROR'
    });
  }
}
