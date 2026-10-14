-- Transactional staging test. ROLLBACK ensures no persistent task or sale.
begin;
insert into asmas.tasks(case_id,agent,action,idempotency_key,payload)
values('SYN-E2E-001','A1','QA_DATABASE_CONTRACT','asmas-qa-db-001','{"synthetic":true}'::jsonb)
on conflict (idempotency_key) do nothing;
select * from asmas.claim_task('asmas-qa-db-001','A1',60);
select asmas.complete_task(id,'{"status":"SUCCEEDED"}'::jsonb,'[{"topic":"asmas:qa","synthetic":true}]'::jsonb)
from asmas.tasks where idempotency_key='asmas-qa-db-001';
select status from asmas.tasks where idempotency_key='asmas-qa-db-001';
rollback;
