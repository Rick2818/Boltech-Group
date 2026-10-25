// Production handover audit: does not access secrets, send mail or change production.
// Keep fail-closed; run with a JSON checklist made from externally verified receipts.
export function auditAgent1Handover(evidence={}){
 const checks={
  'source_apollo_live_read':evidence.apolloLiveRead===true,
  'source_upwork_live_read':evidence.upworkLiveRead===true,
  'source_explee_authenticated':evidence.expleeAuthenticated===true,
  'verified_live_leads':evidence.verifiedLiveLeads===true,
  'redis_durable_receipts':evidence.redisDurableReceipts===true,
  'gmail_business_sender_verified':evidence.gmailSenderVerified===true,
  'gmail_sending_receipt':evidence.gmailAuthorizedSendReceipt===true,
  'crm_read_write_reconciled':evidence.crmReconciled===true,
  'sales_reply_followup_verified':evidence.salesReplyFollowupVerified===true,
  'sales_marketing_coordination':evidence.salesMarketingCoordinationVerified===true,
  'daily_scheduler_certified':evidence.dailySchedulerCertified===true,
  'no_duplicate_or_unapproved_outreach':evidence.noDuplicateOutreachVerified===true,
  'source_archive_recoverable':evidence.archiveRecoverable===true,
  'main_revision_deployed':evidence.mainRevisionDeployed===true
 };
 const missing=Object.keys(checks).filter(k=>!checks[k]);
 return {status:missing.length?'BLOCKED':'READY',ready:missing.length===0,checked:Object.keys(checks).length,passed:Object.keys(checks).length-missing.length,missing,disableLegacyAllowed:missing.length===0,sendAuthorized:false};
}
