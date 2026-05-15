alter table public.edc_leads
  add column if not exists admin_notes text;

comment on column public.edc_leads.admin_notes is
  'Internal admin notes for lead follow-up and triage.';
