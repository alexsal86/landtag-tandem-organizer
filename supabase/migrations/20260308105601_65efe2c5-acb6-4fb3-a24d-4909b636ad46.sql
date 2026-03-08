
-- Dedicated table for Tageszettel daily entries (structured work data)
create table public.day_slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  day_key text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, day_key)
);

create index idx_day_slips_user_day on public.day_slips(user_id, day_key);

alter table public.day_slips enable row level security;

create policy "Users can read own day slips"
  on public.day_slips for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own day slips"
  on public.day_slips for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own day slips"
  on public.day_slips for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own day slips"
  on public.day_slips for delete to authenticated
  using (auth.uid() = user_id);
