import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedLeoWompiIndexRoute } from '../lib/leo_wompi_lean_mode.js';

test('Leo API, its autonomous worker, channels and Rodrigo voice remain available', () => {
  const allowed = [
    '/api/index?leo_sales=1',
    '/api/index?leo_worker=1',
    '/api/index?leo_objectives=1',
    '/api/index?leo_channels=1',
    '/api/index?leo_meta_whatsapp=1',
    '/api/index?rodrigo_speech=1',
    '/api/leo-autonomy-worker',
    '/api/leo-objectives',
    '/api/leo-channels',
    '/api/leo-meta-whatsapp',
    '/api/catalog'
  ];
  for (const path of allowed) {
    assert.equal(allowedLeoWompiIndexRoute(new URL(path, 'https://boltech-group.vercel.app')), true, path);
  }
});

test('Agent 1, marketing, old crons, MCP, retired outreach and specialist actions stay paused', () => {
  const blocked = [
    '/api/index', '/api/index?agent1_cycle=1',
    '/api/agent1-continuous-cycle',
    '/api/index?marketing_sales_cycle=1', '/api/marketing-sales-cycle',
    '/api/index?specialist_chat=1', '/api/index?maria_speech=1',
    '/api/index?mcp=1', '/api/index?explee_hot_leads_sync=1',
    '/api/index?upwork_oauth=start',
    '/api/index?leo_sales=0',
    '/api/cron/master-dispatcher', '/api/index?leo_worker=0',
    '/api/dashboard/metrics', '/api/index?telegram=1',
    '/api/partners?action=metrics', '/api/ai', '/api/lead'
  ];
  for (const path of blocked) {
    assert.equal(allowedLeoWompiIndexRoute(new URL(path, 'https://boltech-group.vercel.app')), false, path);
  }
});
