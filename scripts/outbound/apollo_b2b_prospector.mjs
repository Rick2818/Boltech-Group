import { pathToFileURL } from 'node:url';
import { createApolloClient, validateApolloEmail } from '../../lib/apollo_client.js';

// Compatibility entry points backed by the shared, bounded Apollo client.
export async function enrichCompanyWithApollo(domain, options = {}) {
  return createApolloClient(options).enrichOrganization(domain, options);
}
export async function fetchSavedApolloContacts(options = {}) {
  const batch = await createApolloClient(options).listSavedContacts(options);
  const leads = [];
  for (const contact of batch.contacts) {
    const validation = await validateApolloEmail(contact.contactEmail, options);
    if (validation.mx) leads.push({ ...contact, emailValidation: validation });
  }
  return leads;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = { timestamp: new Date().toISOString(), status: 'FAIL' };
  try {
    const batch = await createApolloClient().listSavedContacts();
    Object.assign(report, { status: 'PASS', pagesRead: batch.pagesRead, providerTotal: batch.totalEntries,
      usableContacts: batch.contacts.length, rejected: batch.rejected });
  } catch (error) { report.code = error.code || 'APOLLO_REQUEST_FAILED'; process.exitCode = 1; }
  console.log(JSON.stringify(report));
}
