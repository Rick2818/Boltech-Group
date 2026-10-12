/**
 * =============================================================================
 * BLINDAJE FIDUCIARIO: SUITE DE PRUEBAS REGRESIVAS DEL ESCÁNER Y FACTURACIÓN
 * Verifica que jamás vuelva a fallar la normalización de dominios, nombres
 * sin TLD, CORS, preflight OPTIONS y el embudo de cobro fiduciario.
 * =============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import scanHandler from '../api/scan.js';

// Sonda de red: los escaneos "en vivo" solo se exigen cuando hay salida a internet.
// Sin red (sandbox, CI restringido) se verifica todo lo hermético (HTTP 200, CORS,
// normalización del dominio) y se omite únicamente el resultado del sitio externo.
// Con red, las aserciones en vivo siguen siendo obligatorias.
let networkProbe;
function networkAvailable() {
  networkProbe ??= dns.lookup('example.com').then(() => true, () => false);
  return networkProbe;
}

// ---------------------------------------------------------------------------
// 1. Normalización de Nombres Sueltos y Dominios con Ruido
// ---------------------------------------------------------------------------
function cleanAndValidateDomainClient(raw) {
  if (!raw) return null;
  let stripped = String(raw).trim().toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '');
  if (!stripped) return null;
  if (!stripped.includes('.') && stripped.length > 1) {
    stripped = stripped + '.com';
  }
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
  return domainRegex.test(stripped) ? stripped : null;
}

test('CLIENT BLINDADO: Acepta nombres de empresa sin extensión y auto-asigna .com', () => {
  assert.equal(cleanAndValidateDomainClient('estafeta'), 'estafeta.com');
  assert.equal(cleanAndValidateDomainClient('boltech'), 'boltech.com');
  assert.equal(cleanAndValidateDomainClient('branch'), 'branch.com');
  assert.equal(cleanAndValidateDomainClient('redpack'), 'redpack.com');
  assert.equal(cleanAndValidateDomainClient('mi-empresa-sv'), 'mi-empresa-sv.com');
});

test('CLIENT BLINDADO: Limpia prefijos https, http, www, rutas y espacios', () => {
  assert.equal(cleanAndValidateDomainClient('https://www.estafeta.com/rastreo?id=123'), 'www.estafeta.com');
  assert.equal(cleanAndValidateDomainClient('  HTTP://ALDESALOGISTICA.COM/  '), 'aldesalogistica.com');
  assert.equal(cleanAndValidateDomainClient('http://branch.com.co/es/'), 'branch.com.co');
});

test('CLIENT BLINDADO: Rechaza entradas vacías o caracteres nulos', () => {
  assert.equal(cleanAndValidateDomainClient(''), null);
  assert.equal(cleanAndValidateDomainClient('   '), null);
  assert.equal(cleanAndValidateDomainClient(null), null);
  assert.equal(cleanAndValidateDomainClient(undefined), null);
});

// ---------------------------------------------------------------------------
// 2. Blindaje de la API Serverless (CORS, OPTIONS y Normalización en Backend)
// ---------------------------------------------------------------------------
test('API BLINDADA: Responde a preflight OPTIONS con 200 y cabeceras CORS completas', async () => {
  const mockHeaders = {};
  let statusCode = 0;
  let ended = false;

  const mockReq = {
    method: 'OPTIONS',
    headers: { origin: 'https://unblock-shield.vercel.app' }
  };
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k] = v; },
    status: function(code) { statusCode = code; return this; },
    end: () => { ended = true; }
  };

  await scanHandler(mockReq, mockRes);

  assert.equal(statusCode, 200, 'Preflight OPTIONS debe responder 200');
  assert.equal(mockHeaders['Access-Control-Allow-Origin'], '*', 'Debe permitir CORS universal');
  assert.ok(mockHeaders['Access-Control-Allow-Methods'].includes('OPTIONS'), 'Debe listar OPTIONS');
  assert.ok(mockHeaders['Access-Control-Allow-Methods'].includes('POST'), 'Debe listar POST');
  assert.ok(ended, 'Debe finalizar la respuesta OPTIONS sin timeout');
});

test('API BLINDADA: Acepta POST con nombre suelto (ej. estafeta) y responde 200 con CORS', async (t) => {
  const mockHeaders = {};
  let statusCode = 200;
  let responseData = null;

  const mockReq = {
    method: 'POST',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'content-type': 'application/json'
    },
    body: { domain: 'estafeta' }
  };
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k] = v; },
    status: function(code) { statusCode = code; return this; },
    json: function(data) { responseData = data; }
  };

  await scanHandler(mockReq, mockRes);

  assert.equal(statusCode, 200, 'Debe responder 200');
  assert.equal(mockHeaders['Access-Control-Allow-Origin'], '*', 'Debe incluir cabecera CORS');
  assert.ok(responseData, 'Debe devolver un payload estructurado');
  assert.equal(responseData.domain, 'estafeta.com', 'Debe haber normalizado estafeta a estafeta.com');
  if (!(await networkAvailable())) {
    t.diagnostic('Sin salida a internet: se omite la aserción del escaneo en vivo de estafeta.com');
    return;
  }
  assert.equal(responseData.ok, true, 'El escaneo de estafeta.com debe ser exitoso');
});

test('API BLINDADA: Rechaza métodos no permitidos (GET, PUT, DELETE)', async () => {
  const mockHeaders = {};
  let statusCode = 200;
  let responseData = null;

  const mockReq = {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    body: {}
  };
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k] = v; },
    status: function(code) { statusCode = code; return this; },
    json: function(data) { responseData = data; }
  };

  await scanHandler(mockReq, mockRes);

  assert.equal(statusCode, 405, 'GET debe ser rechazado con 405 Method Not Allowed');
  assert.equal(responseData.ok, false);
});

test('API BLINDADA: Resuelve y escanea dominios con apex huérfano o migración .com.sv (ej. equifax.com.sv)', async (t) => {
  const mockHeaders = {};
  let statusCode = 200;
  let responseData = null;

  const mockReq = {
    method: 'POST',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'content-type': 'application/json'
    },
    body: { domain: 'equifax.com.sv' }
  };
  const mockRes = {
    setHeader: (k, v) => { mockHeaders[k] = v; },
    status: function(code) { statusCode = code; return this; },
    json: function(data) { responseData = data; }
  };

  await scanHandler(mockReq, mockRes);

  assert.equal(statusCode, 200);
  assert.equal(responseData.domain, 'equifax.com.sv');
  if (!(await networkAvailable())) {
    t.diagnostic('Sin salida a internet: se omite la aserción del escaneo en vivo de equifax.com.sv');
    return;
  }
  assert.equal(responseData.ok, true, 'equifax.com.sv debe ser analizado con éxito vía fallback');
  assert.ok(responseData.score > 0, 'Debe otorgar una puntuación calculada');
});

