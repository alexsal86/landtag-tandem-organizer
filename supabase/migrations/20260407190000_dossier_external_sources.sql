-- Dossier: externe Quellen je Dossier und automatische Link-Erstellung
create extension if not exists pg_trgm;

create table if not exists public.dossier_source_watchers (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_type text not null default 'rss',
  source_name text not null,
  source_url text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  last_checked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dossier_id, source_url)
);

alter table public.dossier_source_watchers enable row level security;

drop policy if exists "Tenant members can view dossier_source_watchers" on public.dossier_source_watchers;
create policy "Tenant members can view dossier_source_watchers"
  on public.dossier_source_watchers for select to authenticated
  using (tenant_id in (
    select tenant_id from public.user_tenant_memberships
    where user_id = auth.uid() and is_active = true
  ));

drop policy if exists "Tenant members can insert dossier_source_watchers" on public.dossier_source_watchers;
create policy "Tenant members can insert dossier_source_watchers"
  on public.dossier_source_watchers for insert to authenticated
  with check (tenant_id in (
    select tenant_id from public.user_tenant_memberships
    where user_id = auth.uid() and is_active = true
  ));

drop policy if exists "Tenant members can update dossier_source_watchers" on public.dossier_source_watchers;
create policy "Tenant members can update dossier_source_watchers"
  on public.dossier_source_watchers for update to authenticated
  using (tenant_id in (
    select tenant_id from public.user_tenant_memberships
    where user_id = auth.uid() and is_active = true
  ));

drop policy if exists "Tenant members can delete dossier_source_watchers" on public.dossier_source_watchers;
create policy "Tenant members can delete dossier_source_watchers"
  on public.dossier_source_watchers for delete to authenticated
  using (tenant_id in (
    select tenant_id from public.user_tenant_memberships
    where user_id = auth.uid() and is_active = true
  ));

create index if not exists idx_dossier_source_watchers_dossier
  on public.dossier_source_watchers(dossier_id);
create index if not exists idx_dossier_source_watchers_tenant_active
  on public.dossier_source_watchers(tenant_id, is_active);

alter table public.dossiers
  add column if not exists last_briefing_at timestamptz;

alter table public.dossier_entries
  add column if not exists source_hash text,
  add column if not exists title_fingerprint text,
  add column if not exists external_published_at timestamptz;

create index if not exists idx_dossier_entries_source_hash
  on public.dossier_entries(tenant_id, dossier_id, source_hash)
  where source_hash is not null;

create unique index if not exists uq_dossier_entries_source_hash
  on public.dossier_entries(tenant_id, dossier_id, source_hash)
  where source_hash is not null;

create index if not exists idx_dossier_entries_link_title_trgm
  on public.dossier_entries using gin (title gin_trgm_ops)
  where entry_type = 'link' and title is not null;

create or replace function public.dossier_is_duplicate_entry(
  p_tenant_id uuid,
  p_dossier_id uuid,
  p_source_hash text,
  p_title text
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dossier_entries e
    where e.tenant_id = p_tenant_id
      and e.dossier_id = p_dossier_id
      and (
        (p_source_hash is not null and e.source_hash = p_source_hash)
        or (
          p_title is not null
          and e.entry_type = 'link'
          and e.title is not null
          and similarity(e.title, p_title) >= 0.82
        )
      )
  );
$$;

create trigger update_dossier_source_watchers_updated_at
  before update on public.dossier_source_watchers
  for each row
  execute function public.update_updated_at_column();
