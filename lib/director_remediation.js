export const remediationFor=code=>({
 WAITING_VERIFIED_PARTNER:{owner:'MARKETING',action:'Verify partner identity, consent and collaboration evidence; do not invent referrals.'},
 COST_EVIDENCE_INCOMPLETE:{owner:'RSI-03',action:'Reconcile actual service delivery and provider cost records; do not infer missing amounts.'},
 WAITING_QUALIFIED_APPROVED_CASE:{owner:'RSI-02',action:'Inspect validated customer replies and request qualified customer scope; do not fabricate interest.'}
}[code]||{owner:'DIRECTORA',action:'Investigate evidence and escalate unresolved blocker.'});
