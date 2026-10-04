import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeApolloPipeline, updatePipelineFile } from '../../lib/apollo_pipeline.js';

export async function syncApolloToActivePipeline({ activePath = resolve('pipeline/leads_contactados_activos.json'),
  apolloPath = resolve('pipeline/apollo_leads_calificados_activos.json') } = {}) {
  const incoming = JSON.parse(await readFile(apolloPath, 'utf8'));
  const result = await updatePipelineFile(activePath, active => mergeApolloPipeline(active, incoming));
  return { status: 'LOCAL_PIPELINE_UPDATED', added: result.added, total: result.records.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncApolloToActivePipeline().then(report => console.log(JSON.stringify(report))).catch(error => {
    console.error(error.code || 'APOLLO_PIPELINE_FAILED'); process.exitCode = 1;
  });
}
