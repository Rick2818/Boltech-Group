import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getPaymentEnvironment } from '../lib/payment_catalog.js';
import { getWompiReadiness, getStrikeReadiness } from '../lib/payment_providers.js';

const server = new McpServer({ name: 'boltech-payments', version: '2.0.0' });

function ok(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

server.tool(
  'payments_status',
  'Estado de configuración de las pasarelas. Nunca revela credenciales.',
  {},
  async () => ok({
    environment: getPaymentEnvironment(),
    strike: getStrikeReadiness(),
    wompi: getWompiReadiness(),
    policy: 'PROVIDER_VERIFICATION_REQUIRED',
    mutations: 'DISABLED_IN_MCP_USE_VERIFIED_PAYMENT_API'
  })
);

server.tool(
  'strike_create_invoice',
  'Deshabilitado por seguridad. Las órdenes reales deben crearse mediante /api/payments para quedar registradas en Payment Orders.',
  { amount_usd: z.number().positive().optional(), description: z.string().optional(), reference: z.string().optional() },
  async () => ({
    isError: true,
    content: [{ type: 'text', text: 'Operación deshabilitada: use /api/payments?action=create para crear una orden Strike persistente y verificable.' }]
  })
);

server.tool(
  'strike_get_invoice',
  'Deshabilitado como herramienta de settlement. La reconciliación se ejecuta server-side contra una orden registrada.',
  { invoice_id: z.string().min(1) },
  async () => ({
    isError: true,
    content: [{ type: 'text', text: 'Operación deshabilitada: consulte el estado de la orden Boltech mediante /api/payments?action=status.' }]
  })
);

server.tool(
  'wompi_create_payment_link',
  'Deshabilitado por seguridad. El checkout real debe originarse en una orden Boltech registrada.',
  { amount_usd: z.number().positive().optional(), amount_cop: z.number().positive().optional(), description: z.string().optional(), reference: z.string().optional() },
  async () => ({
    isError: true,
    content: [{ type: 'text', text: 'Operación deshabilitada: use /api/payments?action=create para crear un checkout Wompi SV persistente y verificable.' }]
  })
);

server.tool(
  'wompi_get_transaction',
  'Deshabilitado como herramienta de settlement. Los estados se verifican en el backend de pagos.',
  { transaction_id: z.string().min(1) },
  async () => ({
    isError: true,
    content: [{ type: 'text', text: 'Operación deshabilitada: la conciliación Wompi se realiza server-side y requiere una orden registrada.' }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[boltech-payments] secure v2 ready; mutation tools are intentionally disabled');
