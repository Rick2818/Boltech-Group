import {createInteragentCoordinator} from './interagent_coordinator.js';

// Keep source errors as codes only; never persist provider messages or credentials.
export const marketingErrorCode = error => /^(?:MARKETING_|INTERAGENT_|GMAIL_|RSI_)[A-Z_]+$/.test(error?.code || '')
  ? error.code : 'MARKETING_OPERATION_UNCONFIRMED';

export function createRsiMarketingCycle(worker = createInteragentCoordinator()) {
  return async function run(rsi) {
    if (rsi === 'MARKETING') {
      const pendingManagement = await worker.marketing.managePending();
      return {...await worker.marketing.metrics(), pendingManagement};
    }
    const failures = [], checks = [];
    const attempt = async (stage, eventId, execute) => {
      try { return {ok:true, result:await execute()}; }
      catch (error) { failures.push({stage, ...(eventId ? {eventId} : {}), code:marketingErrorCode(error)}); return {ok:false}; }
    };
    const followup = rsi === 'RSI-01'
      ? await attempt('FOLLOWUP_SUPPORT', null, () => worker.prepareFollowupSupport()) : null;
    let pending = (await worker.queue(rsi)).pending;
    for (const row of pending.filter(r => r.execution?.status === 'PENDING_AUTHORIZED_EXECUTION' ||
      (r.execution?.status === 'UNKNOWN' && r.action === 'RECONCILE_PROVIDER_RECEIPT_WITHOUT_RESENDING') ||
      (!r.execution && r.executionKind === 'MATERIAL_CREATED' && r.action === 'PREPARE_ROLE_SPECIFIC_MATERIAL')).slice(0,5)) {
      await attempt('ALTERNATIVE', row.eventId, () => worker.executePending({from:rsi,eventId:row.eventId}));
    }
    // Reload after mutations and keep unrelated events moving when one check fails.
    pending = (await worker.queue(rsi)).pending;
    const rows = pending.filter(r => r.material)
      .sort((a,b) => Number(!!b.material.authorizedFollowup)-Number(!!a.material.authorizedFollowup)).slice(0,5);
    let reviewed = 0;
    for (const row of rows) {
      const input = {from:rsi,eventId:row.eventId};
      const review = await attempt('REVIEW', row.eventId, () => worker.marketing.review({...input,materialFingerprint:row.material.fingerprint}));
      if (review.ok) {
        reviewed++;
        const history = await attempt('HISTORY', row.eventId, () => worker.marketing.reconcile(input));
        if (history.ok) checks.push(history.result);
      }
      await attempt('MANAGE', row.eventId, () => worker.marketing.manage(input));
    }
    return {selected:rows.length,reviewed,followupSupport:followup?.result || null,historyChecks:checks,
      failures,sendingPerformed:false,saleInferred:false};
  };
}
