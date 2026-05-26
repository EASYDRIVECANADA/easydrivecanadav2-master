alter table public.edc_leads
  add column if not exists admin_notes text;

comment on column public.edc_leads.admin_notes is
  'Internal admin notes for lead follow-up and triage.';

create or replace function public.edc_prevent_admin_notes_history_rewrite()
returns trigger
language plpgsql
as $$
begin
  if old.admin_notes is null or btrim(old.admin_notes) = '' then
    return new;
  end if;

  if new.admin_notes is null or btrim(new.admin_notes) = '' then
    raise exception 'Lead notes are append-only and cannot be deleted';
  end if;

  if left(btrim(new.admin_notes), length(btrim(old.admin_notes))) <> btrim(old.admin_notes) then
    raise exception 'Lead notes are append-only and existing history cannot be changed';
  end if;

  return new;
end;
$$;

drop trigger if exists edc_leads_admin_notes_append_only on public.edc_leads;

create trigger edc_leads_admin_notes_append_only
before update of admin_notes on public.edc_leads
for each row
execute function public.edc_prevent_admin_notes_history_rewrite();

comment on trigger edc_leads_admin_notes_append_only on public.edc_leads is
  'Prevents deleting or rewriting existing lead notes; new updates must preserve the existing transcript.';
