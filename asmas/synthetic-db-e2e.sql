-- Synthetic DB end-to-end transaction. NEVER sends external mail, invokes AI, or takes payment.
-- A single SYN-E2E-001 fixture; all writes ROLLBACK.
begin;
insert into asmas.leads(lead_id,company,domain,contact_email,source,score,is_synthetic)
values('SYN-E2E-001','CLIENTE SINTETICO','cliente-sintetico.example','compras@cliente-sintetico.example','TEST_FIXTURE',80,true)
on conflict(lead_id) do nothing;
insert into asmas.opportunities(id,lead_id,stage,owner,is_synthetic,quote_amount)
values('SYN-OPP-001','SYN-E2E-001','NEW_LEAD','A5',true,1000)
on conflict(id) do nothing;
insert into asmas.tasks(case_id,agent,action,idempotency_key)
values('SYN-E2E-001','A5','MARKET_SEGMENT','syn-case-001-A5'),
('SYN-E2E-001','A1','QUALIFY_LEAD','syn-case-001-A1'),
('SYN-E2E-001','A2','GENERATE_TEST_QUOTE','syn-case-001-A2'),
('SYN-E2E-001','A3','SIMULATE_CLOSE','syn-case-001-A3'),
('SYN-E2E-001','A4','AUDIT_TEST','syn-case-001-A4')
on conflict(idempotency_key) do nothing;
select * from asmas.claim_task('syn-case-001-A5','A5');
select * from asmas.claim_task('syn-case-001-A1','A1');
select * from asmas.claim_task('syn-case-001-A2','A2');
select * from asmas.claim_task('syn-case-001-A3','A3');
select * from asmas.claim_task('syn-case-001-A4','A4');
select asmas.complete_task(id,'{"synthetic":true,"status":"SUCCEEDED"}'::jsonb,'[]'::jsonb)
from asmas.tasks where idempotency_key like 'syn-case-001-%';
select count(*) filter(where status='SUCCEEDED') as completed,
count(distinct agent) as distinct_agents from asmas.tasks where idempotency_key like 'syn-case-001-%';
rollback;
