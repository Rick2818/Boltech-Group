import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { researchCompanyOrLead } from '../../lib/lead_intelligence.js';

export function createBoltechRemoteMcpServer() {
  const server = new McpServer({
    name: 'boltech-group-remote-mcp',
    version: '1.0.0'
  });

  server.registerTool(
    'boltech_status',
    {
      title: 'Boltech MCP Status',
      description: 'Devuelve el estado básico y las capacidades de solo lectura del gateway MCP de Boltech Group.',
      inputSchema: z.object({})
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({
          service: 'Boltech Group Remote MCP',
          status: 'ok',
          mode: 'read-first',
          write_tools_enabled: false,
          timestamp: new Date().toISOString()
        })
      }]
    })
  );

  server.registerTool(
    'get_bitcoin_market_data',
    {
      title: 'Bitcoin Market Data',
      description: 'Obtiene el precio BTC/USD usando una fuente pública. No mueve fondos ni crea pagos.',
      inputSchema: z.object({})
    },
    async () => {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      if (!response.ok) throw new Error('BITCOIN_DATA_UNAVAILABLE');
      const data = await response.json();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            asset: 'BTC/USD',
            price_usd: data?.bitcoin?.usd ?? null,
            source: 'CoinGecko',
            timestamp: new Date().toISOString()
          })
        }]
      };
    }
  );

  server.registerTool(
    'research_b2b_lead',
    {
      title: 'Research B2B Lead',
      description: 'Investiga una empresa o prospecto mediante el motor de inteligencia configurado en Boltech. Es una acción de lectura.',
      inputSchema: z.object({
        query: z.string().min(2).max(500)
      })
    },
    async ({ query }) => {
      const result = await researchCompanyOrLead(query);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      };
    }
  );

  return server;
}
