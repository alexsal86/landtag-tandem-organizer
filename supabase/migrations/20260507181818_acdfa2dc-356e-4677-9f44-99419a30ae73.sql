
create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android','web')),
  device_id text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists mobile_push_tokens_user_idx on public.mobile_push_tokens(user_id) where is_active;

alter table public.mobile_push_tokens enable row level security;

drop policy if exists "users manage own push tokens" on public.mobile_push_tokens;
create policy "users manage own push tokens"
  on public.mobile_push_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_mobile_push_tokens()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_mobile_push_tokens on public.mobile_push_tokens;
create trigger trg_touch_mobile_push_tokens
  before update on public.mobile_push_tokens
  for each row execute function public.touch_mobile_push_tokens();
