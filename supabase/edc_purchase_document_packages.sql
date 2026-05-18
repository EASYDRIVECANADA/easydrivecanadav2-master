alter table public.edc_purchase_submissions
  add column if not exists document_package_token text,
  add column if not exists document_package_created_at timestamptz,
  add column if not exists bos_pdf_url text,
  add column if not exists carfax_files jsonb not null default '[]'::jsonb,
  add column if not exists document_package_status text;

create unique index if not exists edc_purchase_submissions_document_package_token_idx
  on public.edc_purchase_submissions (document_package_token)
  where document_package_token is not null;

insert into storage.buckets (id, name, public)
values ('purchase-documents', 'purchase-documents', false)
on conflict (id) do update set public = false;
