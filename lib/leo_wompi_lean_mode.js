// Emergency low-CPU mode. Keep Leo, its approved customer channels and Wompi catalog only.
// Wompi's payment creation and signed callbacks run independently in api/payments.js.
const LEO_PATHS = new Set([
  '/api/leo-autonomy-worker',
  '/api/leo-objectives',
  '/api/leo-channels',
  '/api/leo-meta-whatsapp'
]);
const LEO_QUERY_FLAGS = [
  'leo_sales', 'leo_worker', 'leo_objectives',
  'leo_channels', 'leo_meta_whatsapp', 'rodrigo_speech', 'catalog'
];
export function allowedLeoWompiIndexRoute(url) {
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/api/catalog') return true;
  if (LEO_PATHS.has(pathname)) return true;
  // Vercel may normalize a consolidated function pathname (e.g. /api/index -> /api).
  // This helper is invoked only inside api/index.js: the exact allowlisted flag,
  // not the incoming alias/path spelling, identifies Leo's authorized branch.
  return LEO_QUERY_FLAGS.some(key => url.searchParams.get(key) === '1');
}

export function pauseNoncoreVercelFunction(req, res, environment = process.env.VERCEL_ENV) {
  // Local/CI behavior remains available for regression testing and restoration.
  if (environment !== 'production' && environment !== 'preview') return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(410).json({
    success: false,
    code: 'BOLTECH_LEO_WOMPI_ONLY',
    error: 'This nonessential service is temporarily paused to reduce compute usage.'
  });
  return true;
}
