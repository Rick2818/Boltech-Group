import { apolloError } from '../../lib/apollo_client.js';
import { pathToFileURL } from 'node:url';

// Retired: this legacy bulk dispatcher had unsupported claims and no durable
// cross-worker delivery ledger. Approved sales agents remain the outbound path.
export async function dispatchApolloBatch() {
  throw apolloError('APOLLO_LEGACY_DISPATCH_DISABLED');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  dispatchApolloBatch().catch(error => { console.error(error.code); process.exitCode = 1; });
}
