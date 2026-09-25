/**
 * =============================================================================
 * BOLTECH GROUP — INTEGRACIÓN OFICIAL VERCEL AI SDK
 * =============================================================================
 * Soporte unificado para Google Gemini & OpenAI con Streaming, Function Calling
 * y Generación Estructurada (Zod / JSON Schema).
 * =============================================================================
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject as aiGenerateObject,
  streamObject as aiStreamObject
} from 'ai';

/**
 * Obtener cliente configurado de Google Generative AI
 */
export function getGoogleClient(customApiKey = null) {
  const apiKey = (customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  return createGoogleGenerativeAI({
    apiKey: apiKey || 'dummy-key-for-init'
  });
}

/**
 * Obtener cliente configurado de OpenAI
 */
export function getOpenAIClient(customApiKey = null, customBaseURL = null) {
  const apiKey = (customApiKey || process.env.OPENAI_API_KEY || '').trim();
  return createOpenAI({
    apiKey: apiKey || 'dummy-key-for-init',
    baseURL: customBaseURL || process.env.OPENAI_BASE_URL || undefined
  });
}

/**
 * Obtener cliente configurado de Qwen (DashScope Alibaba Cloud, OpenRouter, Groq u Ollama)
 */
export function getQwenClient(customApiKey = null, customBaseURL = null) {
  const apiKey = (
    customApiKey ||
    process.env.QWEN_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();

  const baseURL = (
    customBaseURL ||
    process.env.QWEN_BASE_URL ||
    (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
  ).trim();

  return createOpenAI({
    apiKey: apiKey || 'dummy-key-for-init',
    baseURL: baseURL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
  });
}

/**
 * Resuelve el modelo de lenguaje adecuado según el proveedor y configuración
 * @param {Object} options
 * @param {'google'|'openai'|'qwen'|'dashscope'|'openrouter'} [options.provider='google']
 * @param {string} [options.modelName]
 * @param {string} [options.apiKey]
 * @param {string} [options.baseURL]
 */
export function resolveLanguageModel(options = {}) {
  const provider = (options.provider || 'google').toLowerCase();
  const apiKey = options.apiKey;
  const baseURL = options.baseURL;

  if (provider === 'qwen' || provider === 'dashscope' || provider === 'openrouter') {
    const qwen = getQwenClient(apiKey, baseURL);
    const modelName = options.modelName || 'qwen-3.8';
    return qwen(modelName);
  }

  if (provider === 'openai') {
    const openai = getOpenAIClient(apiKey, baseURL);
    const modelName = options.modelName || 'gpt-4o-mini';
    return openai(modelName);
  }

  // Predeterminado: Google Gemini (alineado con la arquitectura soberana de Boltech)
  const google = getGoogleClient(apiKey);
  const modelName = options.modelName || 'gemini-1.5-flash';
  return google(modelName);
}

/**
 * Diagnóstico de estado de claves y modelos para el Cockpit / API
 */
export function getAIProvidersStatus() {
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  const openAiKey = (process.env.OPENAI_API_KEY || '').trim();
  const qwenKey = (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();

  return {
    success: true,
    sdk: 'vercel-ai-sdk',
    providers: {
      qwen: {
        configured: Boolean(qwenKey && qwenKey.length > 5),
        defaultModel: 'qwen-3.8',
        supportedModels: [
          'qwen-3.8',
          'qwen-2.5-72b-instruct',
          'qwen-2.5-coder-32b-instruct',
          'qwen-2.5-7b-instruct',
          'qwen-plus',
          'qwen-turbo',
          'qwen-max'
        ]
      },
      google: {
        configured: Boolean(geminiKey && geminiKey.length > 5),
        defaultModel: 'gemini-1.5-flash',
        supportedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash']
      },
      openai: {
        configured: Boolean(openAiKey && openAiKey.length > 5),
        defaultModel: 'gpt-4o-mini',
        supportedModels: ['gpt-4o-mini', 'gpt-4o']
      }
    }
  };
}

/**
 * Generación de texto síncrona
 */
export async function generateAIResponse({
  prompt,
  system = 'Eres el Asistente Ejecutivo de BolTech Group.',
  provider = 'google',
  modelName = null,
  apiKey = null,
  baseURL = null,
  temperature = 0.7,
  maxTokens = 2048
}) {
  const model = resolveLanguageModel({ provider, modelName, apiKey, baseURL });
  return await aiGenerateText({
    model,
    prompt,
    system,
    temperature,
    maxTokens
  });
}

/**
 * Flujo de streaming de texto
 */
export async function streamAIResponse({
  prompt,
  system = 'Eres el Asistente Ejecutivo de BolTech Group.',
  provider = 'google',
  modelName = null,
  apiKey = null,
  baseURL = null,
  temperature = 0.7,
  maxTokens = 2048
}) {
  const model = resolveLanguageModel({ provider, modelName, apiKey, baseURL });
  return await aiStreamText({
    model,
    prompt,
    system,
    temperature,
    maxTokens
  });
}

// Re-exportar primitivas del SDK para máxima extensibilidad
export {
  aiGenerateText as generateText,
  aiStreamText as streamText,
  aiGenerateObject as generateObject,
  aiStreamObject as streamObject
};
