export const AGENT_DEFINITIONS=Object.freeze({
 A1:{name:'Vendedor',skills:['b2b_research','lead_validation','lead_scoring','deduplication','handoff'],tools:['lead_search','record_lead'],maxTurns:8},
 A2:{name:'Cotizaciones y Seguimiento',skills:['needs_analysis','approved_pricing','proposal','followup'],tools:['read_catalog','draft_quote','draft_email'],maxTurns:8},
 A3:{name:'Cierre',skills:['negotiation','payment_verification','closeout'],tools:['quote_read','payment_status','admin_notice'],maxTurns:8},
 A4:{name:'Director',skills:['routing','incident_triage','rsi','reporting'],tools:['queue_inspection','read_metrics'],maxTurns:8},
 A5:{name:'Mercadeo',skills:['market_research','icp','segmentation','campaign_analysis'],tools:['market_research','campaign_plan'],maxTurns:8}
});
export function authorize(agent,tool){return AGENT_DEFINITIONS[agent]?.tools.includes(tool)===true;}
