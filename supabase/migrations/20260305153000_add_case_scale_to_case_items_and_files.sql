alter table public.case_items
  add column if not exists case_scale text,
  add constraint case_items_case_scale_check check (case_scale in ('small', 'large'));

alter table public.case_files
  add column if not exists case_scale text,
  add constraint case_files_case_scale_check check (case_scale in ('small', 'large'));
