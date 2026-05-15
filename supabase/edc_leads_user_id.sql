alter table public.edc_leads
  add column if not exists user_id uuid;

create index if not exists edc_leads_user_id_idx
  on public.edc_leads (user_id);

comment on column public.edc_leads.user_id is
  'Owner user id for manually created or imported leads. External website leads may remain unassigned.';
