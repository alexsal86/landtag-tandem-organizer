alter table public.case_items
  add column if not exists subject text,
  add column if not exists summary text,
  add column if not exists source_received_at timestamptz,
  add column if not exists source_reference text,
  add column if not exists reporter_name text,
  add column if not exists reporter_contact text,
  add column if not exists intake_payload jsonb,
  add column if not exists confidentiality_level text,
  add column if not exists contains_personal_data boolean not null default false;

alter table public.case_items
  drop constraint if exists case_items_confidentiality_level_check;

alter table public.case_items
  add constraint case_items_confidentiality_level_check
  check (
    confidentiality_level is null
    or confidentiality_level in ('public', 'internal', 'restricted', 'strictly_confidential')
  );

update public.case_items
set
  summary = coalesce(summary, nullif(trim(resolution_summary), '')),
  subject = coalesce(subject, nullif(trim(resolution_summary), ''))
where resolution_summary is not null;
