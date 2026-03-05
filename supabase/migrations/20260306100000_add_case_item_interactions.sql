create table public.case_item_interactions (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  interaction_type text not null check (interaction_type in ('call','email','social','meeting','note','letter','system')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  subject text not null,
  details text,
  is_resolution boolean not null default false,
  source_type text check (source_type in ('contacts','documents','letters','tasks')),
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_item_interactions enable row level security;

create policy "Users can manage case item interactions"
on public.case_item_interactions
for all
using (
  exists (
    select 1
    from public.case_files cf
    where cf.id = case_item_interactions.case_file_id
      and cf.tenant_id = any (get_user_tenant_ids(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.case_files cf
    where cf.id = case_item_interactions.case_file_id
      and cf.tenant_id = any (get_user_tenant_ids(auth.uid()))
  )
);

create index idx_case_item_interactions_case_file_id on public.case_item_interactions(case_file_id);
create index idx_case_item_interactions_created_at on public.case_item_interactions(created_at desc);

create trigger update_case_item_interactions_updated_at
before update on public.case_item_interactions
for each row
execute function public.update_updated_at_column();

create or replace function public.require_resolution_interaction_on_case_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' and coalesce(old.status, '') <> 'closed' then
    if not exists (
      select 1
      from public.case_item_interactions cii
      where cii.case_file_id = new.id
        and cii.is_resolution = true
    ) then
      raise exception 'Zum Abschließen des Vorgangs ist mindestens eine Abschlussinteraktion erforderlich.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_resolution_interaction_before_case_close on public.case_files;
create trigger ensure_resolution_interaction_before_case_close
before update on public.case_files
for each row
execute function public.require_resolution_interaction_on_case_close();
