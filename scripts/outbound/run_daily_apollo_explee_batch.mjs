import { apolloError, createApolloClient } from '../../lib/apollo_client.js';
import { pathToFileURL } from 'node:url';

// Read-only collection. No implicit paid enrichment, audit, video, or outreach.
export async function runDailyBatch(options = {}) {
  const batch = await createApolloClient(options).listSavedContacts(options);
  return { status: 'APOLLO_READ_CONFIRMED', pagesRead: batch.pagesRead, contacts: batch.contacts.length,
    providerTotal: batch.totalEntries, rejected: batch.rejected };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runDailyBatch().then(report => console.log(JSON.stringify(report))).catch(error => {
    console.error(error.code || apolloError('APOLLO_BATCH_FAILED').code); process.exitCode = 1;
  });
}
