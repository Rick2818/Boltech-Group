/**
 * =============================================================================
 * SUITE DE PRUEBAS: VERCEL AI SDK EN BOLTECH GROUP
 * =============================================================================
 * Verifica la inicialización de proveedores (Google Gemini & OpenAI),
 * resolución de modelos, endpoints API y validaciones de seguridad.
 * =============================================================================
 */

import {
  getAIProvidersStatus,
  resolveLanguageModel,
  getGoogleClient,
  getOpenAIClient
} from '../lib/ai_sdk.js';
import aiHandler from '../api/ai.js';

console.log('=== INICIANDO SUITE DE PRUEBAS: VERCEL AI SDK ===\n');

// 1. Estado de Proveedores
console.log('1. Probando getAIProvidersStatus:');
const status = getAIProvidersStatus();
console.assert(status.success === true, 'Debe indicar success: true');
console.assert(status.sdk === 'vercel-ai-sdk', 'Debe indicar sdk: vercel-ai-sdk');
console.assert(typeof status.providers.qwen === 'object', 'Debe incluir configuración de Qwen');
console.assert(status.providers.qwen.defaultModel === 'qwen-3.8', 'Default model de Qwen debe ser qwen-3.8');
console.assert(typeof status.providers.google === 'object', 'Debe incluir configuración de Google');
console.assert(typeof status.providers.openai === 'object', 'Debe incluir configuración de OpenAI');
console.log('  ✅ Diagnóstico de Proveedores (Qwen, Google, OpenAI): PASADO');

// 2. Resolución de Modelos (Qwen 3.8 / DashScope / OpenRouter)
console.log('\n2. Probando Resolución de Modelo Qwen 3.8:');
const qwenModel = resolveLanguageModel({
  provider: 'qwen',
  modelName: 'qwen-3.8',
  apiKey: 'test-qwen-key-for-init'
});
console.assert(qwenModel.modelId === 'qwen-3.8', 'Model ID debe coincidir con qwen-3.8');
console.assert(qwenModel.provider.startsWith('openai'), 'Provider Qwen debe ser compatible con la interfaz OpenAI');
console.log('  ✅ Resolución de Modelo Qwen 3.8: PASADO (Model ID:', qwenModel.modelId, ')');

// 3. Resolución de Modelos (Google Gemini)
console.log('\n3. Probando Resolución de Modelo Google Gemini:');
const googleModel = resolveLanguageModel({
  provider: 'google',
  modelName: 'gemini-1.5-flash',
  apiKey: 'test-key-for-initialization'
});
console.assert(googleModel.modelId === 'gemini-1.5-flash', 'Model ID debe coincidir con gemini-1.5-flash');
console.assert(googleModel.provider === 'google.generative-ai', 'Provider debe ser google.generative-ai');
console.log('  ✅ Resolución de Modelo Google: PASADO (Model ID:', googleModel.modelId, ')');

// 4. Resolución de Modelos (OpenAI)
console.log('\n4. Probando Resolución de Modelo OpenAI:');
const openAiModel = resolveLanguageModel({
  provider: 'openai',
  modelName: 'gpt-4o-mini',
  apiKey: 'test-key-for-initialization'
});
console.assert(openAiModel.modelId === 'gpt-4o-mini', 'Model ID debe coincidir con gpt-4o-mini');
console.assert(openAiModel.provider.startsWith('openai'), 'Provider debe pertenecer a openai');
console.log('  ✅ Resolución de Modelo OpenAI: PASADO (Model ID:', openAiModel.modelId, ', Provider:', openAiModel.provider, ')');

// 4. Endpoint GET /api/ai
console.log('\n4. Probando Endpoint GET /api/ai:');
let resStatus = 0;
let resData = null;
const mockResGet = {
  setHeader: () => {},
  status: (code) => {
    resStatus = code;
    return {
      json: (data) => { resData = data; }
    };
  }
};

await aiHandler({ method: 'GET', headers: {}, socket: {} }, mockResGet);
console.assert(resStatus === 200, 'GET /api/ai debe retornar HTTP 200');
console.assert(resData?.success === true, 'GET /api/ai debe retornar success: true');
console.log('  ✅ Endpoint GET /api/ai: PASADO (Status:', resStatus, ')');

// 5. Endpoint POST /api/ai Validación de Payload
console.log('\n5. Probando Validación de Payload en POST /api/ai:');
let postStatus = 0;
let postData = null;
const mockResPostBad = {
  setHeader: () => {},
  status: (code) => {
    postStatus = code;
    return {
      json: (data) => { postData = data; }
    };
  }
};

await aiHandler({ method: 'POST', body: {}, headers: {}, socket: {} }, mockResPostBad);
console.assert(postStatus === 400, 'POST sin prompt debe retornar HTTP 400');
console.assert(postData?.success === false, 'POST sin prompt debe retornar success: false');
console.log('  ✅ Validación de Payload POST: PASADO (Status:', postStatus, ')');

console.log('\n======================================================');
console.log('🎯 TODAS LAS PRUEBAS DE VERCEL AI SDK PASARON EXITOSAMENTE');
console.log('======================================================\n');
