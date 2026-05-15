alter table public.edc_leads
  add column if not exists manager_status text;

comment on column public.edc_leads.manager_status is
  'Manager-controlled lead workflow status such as AWAITING DECISION, PENDING, PENDING (BHPH), or DECLINED.';
