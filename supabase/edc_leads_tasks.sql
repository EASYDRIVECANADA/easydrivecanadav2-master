alter table public.edc_leads
  add column if not exists task_note text,
  add column if not exists task_due_at timestamptz,
  add column if not exists task_completed_at timestamptz;

create index if not exists edc_leads_task_due_at_idx
  on public.edc_leads (task_due_at)
  where task_due_at is not null and task_completed_at is null;

comment on column public.edc_leads.task_note is
  'Internal follow-up task note for lead reminders.';

comment on column public.edc_leads.task_due_at is
  'Due date/time for the active lead follow-up task.';

comment on column public.edc_leads.task_completed_at is
  'Timestamp when the active lead follow-up task was completed.';
