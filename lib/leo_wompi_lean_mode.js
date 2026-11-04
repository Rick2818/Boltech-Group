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
  'leo_channels', 'leo_meta_whatsapp', 'rodrigo_speech'
];
export function allowedLeoWompiIndexRoute(url) {
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  if (pathname === '/api/catalog') return true;
  if (LEO_PATHS.has(pathname)) return true;
  if (pathname !== '/api/index') return false;
  return LEO_QUERY_FLAGS.some(key => url.searchParams.get(key) === '1');
}
