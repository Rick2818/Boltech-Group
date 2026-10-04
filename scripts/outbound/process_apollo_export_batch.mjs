import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateApolloEmail } from '../../lib/apollo_client.js';
import { parseApolloCsv, syncApolloContacts, updatePipelineFile } from '../../lib/apollo_pipeline.js';
import { createApolloCrmQueue } from '../../lib/apollo_crm_transport.js';

export async function processApolloExportBatch({ csvPath = resolve('data/apollo_leads_batch_1.csv'),
  outputFile = resolve('pipeline/apollo_leads_calificados_activos.json'), validateEmail = validateApolloEmail,
  queue = createApolloCrmQueue() } = {}) {
  const batch = parseApolloCsv(await readFile(csvPath, 'utf8'));
  const contacts = []; let noMx = 0;
  for (const contact of batch.contacts) {
    const validation = await validateEmail(contact.contactEmail);
    if (validation.mx) contacts.push({ ...contact, emailValidation: validation });
    else noMx++;
  }
  const crm = await syncApolloContacts(contacts, queue);
  await updatePipelineFile(outputFile, existing => {
    if (!Array.isArray(existing)) throw new Error('APOLLO_INVALID_PIPELINE');
    const index = new Map(existing.map(c => [c.contactEmail.toLowerCase(), c]));
    for (const contact of contacts) index.set(contact.contactEmail.toLowerCase(), { ...index.get(contact.contactEmail.toLowerCase()), ...contact });
    return { records: [...index.values()] };
  });
  return { status: crm.providerConfirmed === crm.submitted ? 'SYNCED_PROVIDER_CONFIRMED' : 'CRM_QUEUED',
    imported: contacts.length, rejected: batch.rejected + noMx, ...crm };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  processApolloExportBatch().then(report => console.log(JSON.stringify(report))).catch(error => {
    console.error(error.code || 'APOLLO_IMPORT_FAILED'); process.exitCode = 1;
  });
}
