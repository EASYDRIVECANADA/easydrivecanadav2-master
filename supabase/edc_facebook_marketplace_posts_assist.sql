alter table public.edc_facebook_marketplace_posts
  add column if not exists assist_status text not null default 'not_started',
  add column if not exists assist_started_at timestamptz,
  add column if not exists assist_completed_at timestamptz,
  add column if not exists assist_error text,
  add column if not exists assist_payload jsonb not null default '{}'::jsonb;

create index if not exists edc_facebook_marketplace_posts_assist_status_idx
  on public.edc_facebook_marketplace_posts (assist_status);

comment on column public.edc_facebook_marketplace_posts.assist_status is
  'Local browser assistance status: not_started, started, needs_review, failed, or cancelled.';

comment on column public.edc_facebook_marketplace_posts.assist_payload is
  'Last payload sent to the local browser assistant runner.';
