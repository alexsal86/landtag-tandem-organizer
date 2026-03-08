
-- Create user_preferences table for syncing user settings across devices
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, tenant_id, key)
);

-- Index for fast lookups by user
create index idx_user_preferences_user_tenant on public.user_preferences(user_id, tenant_id);

-- Enable RLS
alter table public.user_preferences enable row level security;

-- Users can only read their own preferences
create policy "Users can read own preferences"
  on public.user_preferences for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can insert their own preferences
create policy "Users can insert own preferences"
  on public.user_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can update their own preferences
create policy "Users can update own preferences"
  on public.user_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own preferences
create policy "Users can delete own preferences"
  on public.user_preferences for delete
  to authenticated
  using (auth.uid() = user_id);
