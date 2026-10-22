import {MARKETING_PLAYBOOK} from './marketing_commercial_playbook.js';
// Single verified positioning contract shared by the two commercial agents.
// Proposed features are not advertised as certified until provider evidence exists.
export const BOLTECH_POSITIONING=Object.freeze({
  version:'2026-10-21-v3',
  primaryMarket:'US_B2B',
  primarySegment:'US manufacturing and metal fabrication teams handling quote requests',
  otherIndustriesEligible:true,
  brand:'Boltech Group',
  model:'Managed AI Operations',
  promise:'AI-assisted business workflows with measurable, verifiable execution',
  agents:Object.freeze(['Agente 1 de Ventas','Agente de Mercadeo']),
  differentiators:Object.freeze([
    'Measured business outcomes','24/7 cloud execution with monitored availability',
    'Proof of Work with durable receipts','Proof of Value using agreed customer baselines',
    'Supervised continuous improvement','Integration with existing business tools'
  ]),
  offers:Object.freeze(['QuoteFlow','LeadFlow','ServiceFlow']),
  certifiedFeatures:Object.freeze([]),
  implementationPriceUsd:600,
  generalAgentImplementationPriceUsd:900,
  paymentMilestones:Object.freeze([50,50]),
  managed247PriceStatus:'UNQUOTED',
  safeguards:Object.freeze(['No fabricated ROI or case studies','No uptime guarantee until SLA certified','No unauthorized outreach','No Wompi changes'])
});
export function positioningForSales({evidence={}}={}){
 const verified=Object.entries(evidence).filter(([,v])=>v===true).map(([k])=>k);
 return {audience:'US manufacturing and metal fabrication B2B first; other sectors by scoped quote',message:'Beyond AI agents: real work, verifiable outcomes, measurable value.',verifiedClaims:verified,commercialTerms:{implementationUsd:600,generalAgentImplementationUsd:900,upfrontPercent:50,completionPercent:50,recurringService:'Separate quotation required'},send:false};
}
export function positioningForMarketing({evidence={}}={}){
 return {playbookVersion:MARKETING_PLAYBOOK.version,demonstrations:MARKETING_PLAYBOOK.demonstrations,problemMessages:MARKETING_PLAYBOOK.problemMessages,library:MARKETING_PLAYBOOK.library,evidencePolicy:MARKETING_PLAYBOOK.evidence,measurement:MARKETING_PLAYBOOK.measurement,message:'Beyond AI agents. Real Work. Measurable Results.',angles:['workflow bottlenecks','traceability','time saved with customer baseline'],proofRequired:true,publishReady:Object.values(evidence).some(v=>v===true),execute:false};
}
