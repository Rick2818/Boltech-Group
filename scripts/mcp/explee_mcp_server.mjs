#!/usr/bin/env node
/**
 * ==============================================================================
 * BOLTECH GROUP — EXPLEE AI MCP SERVER (STDIO JSON-RPC 2.0)
 * ==============================================================================
 * Servidor MCP oficial para prospección semántica, sondeo de hot leads y
 * enriquecimiento B2B conectado a Boltech Group y HubSpot.
 * ==============================================================================
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const EXPLEE_API_KEY = (process.env.EXPLEE_API_KEY || '').trim();
const EXPLEE_BASE_URL = process.env.EXPLEE_API_URL || 'https://api.explee.com';

const TOOLS = [
  {
    name: 'explee_search_prospects',
    description: 'Realiza búsquedas semánticas de prospectos B2B en Explee AI filtrando por industria, cargo y país.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Criterio de búsqueda semántica (ej. "Directores de Operaciones en logística de Centroamérica").' },
        limit: { type: 'number', default: 10, description: 'Cantidad máxima de prospectos.' },
        country: { type: 'string', description: 'Código de país (SV, GT, CO, MX, CR, PA).' }
      },
      required: ['query']
    }
  },
  {
    name: 'explee_poll_hot_leads',
    description: 'Lee un archivo local de leads sin verificar; no consulta Explee en tiempo real.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20, description: 'Límite de leads a consultar.' }
      }
    }
  },
  {
    name: 'explee_enrich_company',
    description: 'Enriquecimiento no implementado; devuelve un estado explícito sin inventar datos.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Dominio de la empresa (ej. empresa.com).' }
      },
      required: ['domain']
    }
  },
  {
    name: 'explee_sync_hot_lead_to_crm',
    description: 'Sincronización no implementada; devuelve un estado explícito sin crear un deal ficticio.',
    inputSchema: {
      type: 'object',
      properties: {
        leadEmail: { type: 'string', description: 'Correo del prospecto calificado.' },
        company: { type: 'string', description: 'Nombre de la empresa.' },
        why_hot: { type: 'string', description: 'Causa o mensaje del prospecto que detonó el interés.' },
        suggestedAmount: { type: 'number', default: 69, description: 'Monto sugerido en USD.' }
      },
      required: ['leadEmail', 'company', 'why_hot']
    }
  }
];

function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      await handleMessage(message);
    } catch (err) {
      console.error('[Explee MCP] Error procesando JSON-RPC:', err.message);
    }
  }
});

async function handleMessage(message) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'boltech-explee-mcp',
          version: '1.0.0'
        }
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS }
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      let result;

      switch (name) {
        case 'explee_search_prospects': {
          if (!EXPLEE_API_KEY) throw new Error('EXPLEE_API_KEY_REQUIRED');
          const query = args.query;
          const limit = args.limit || 10;
          try {
            const resp = await fetch(`${EXPLEE_BASE_URL}/companies/search`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${EXPLEE_API_KEY}`,
                'X-API-Key': EXPLEE_API_KEY
              },
              body: JSON.stringify({ prompt: query, limit, country: args.country })
            });

            if (resp.ok) {
              const data = await resp.json();
              result = { success: true, count: data?.results?.length || 0, prospects: data.results || [] };
            } else throw new Error(`EXPLEE_HTTP_${resp.status}`);
          } catch (e) {
            throw new Error(`EXPLEE_SEARCH_FAILED: ${e.message}`);
          }
          break;
        }

        case 'explee_poll_hot_leads': {
          const hotLeadsFile = path.resolve('pipeline', 'leads_explee_ai_verificados.json');
          let leads = [];
          if (fs.existsSync(hotLeadsFile)) {
            try {
              leads = JSON.parse(fs.readFileSync(hotLeadsFile, 'utf8'));
            } catch (e) {}
          }

          result = {
            success: false,
            totalHotLeads: leads.length,
            leads: leads.slice(0, args.limit || 20),
            source: 'Local pipeline snapshot',
            reason: 'UNVERIFIED_LOCAL_DATA'
          };
          break;
        }

        case 'explee_enrich_company': {
          result = { success: false, reason: 'EXPLEE_ENRICHMENT_NOT_IMPLEMENTED' };
          break;
        }

        case 'explee_sync_hot_lead_to_crm': {
          result = { success: false, reason: 'HUBSPOT_SYNC_NOT_IMPLEMENTED' };
          break;
        }

        default:
          throw new Error(`Herramienta no reconocida en Explee MCP: ${name}`);
      }

      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        }
      });
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message
        }
      });
    }
  }
}
