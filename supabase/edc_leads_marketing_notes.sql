alter table public.edc_leads
  add column if not exists marketing_notes text;

comment on column public.edc_leads.marketing_notes is
  'Editable internal notes for marketing analysis and customer targeting exports.';
